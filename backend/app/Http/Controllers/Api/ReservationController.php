<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Guest;
use App\Models\Reservation;
use App\Models\Room;
use App\Models\Setting;
use App\Services\OverdueReservationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReservationController extends Controller
{
    public function index(Request $request)
    {
        (new OverdueReservationService())->detectAndFlagOverdue();

        $query = Reservation::with(['guest', 'room.roomType', 'payments']);

        if ($search = $request->search) {
            $query->where(function ($q) use ($search) {
                $q->where('reservation_number', 'like', "%{$search}%")
                    ->orWhereHas('guest', function ($q) use ($search) {
                        $q->where('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%");
                    })
                    ->orWhereHas('room', function ($q) use ($search) {
                        $q->where('room_number', 'like', "%{$search}%");
                    });
            });
        }

        if ($status = $request->status) {
            $statuses = array_map('trim', explode(',', $status));
            $query->whereIn('status', $statuses);
        }

        if ($from = $request->date_from) {
            $query->where('check_in', '>=', $from);
        }

        if ($to = $request->date_to) {
            $query->where('check_out', '<=', $to);
        }

        $sortField = $request->sort_field ?? 'created_at';
        $sortDir = $request->sort_dir ?? 'desc';

        $sortable = ['reservation_number', 'check_in', 'check_out', 'total_amount', 'status', 'payment_status', 'created_at', 'updated_at'];
        if (! in_array($sortField, $sortable)) {
            $sortField = 'created_at';
        }
        if (! in_array(strtolower($sortDir), ['asc', 'desc'])) {
            $sortDir = 'desc';
        }

        $query->orderBy($sortField, $sortDir);

        return response()->json($query->paginate($request->per_page ?? 10));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'guest_first_name' => 'required|string|max:255',
            'guest_last_name' => 'required|string|max:255',
            'guest_email' => 'nullable|email|max:255',
            'guest_phone' => 'required|string|max:50',
            'room_id' => 'required|exists:rooms,id',
            'check_in' => 'required|date|after_or_equal:today',
            'check_out' => 'required|date|after:check_in',
            'adults' => 'required|integer|min:1',
            'children' => 'nullable|integer|min:0',
            'source' => 'nullable|string|max:50',
            'special_requests' => 'nullable|string',
            'price_per_night' => 'nullable|numeric|min:0',
            'discount_percent' => 'nullable|numeric|min:0|max:100',
            'status' => 'sometimes|in:pending,confirmed',
        ]);

        $reservation = DB::transaction(function () use ($data, $request) {
            $guest = null;
            if (! empty($data['guest_email'])) {
                $guest = Guest::where('email', $data['guest_email'])->first();
            }
            if (! $guest) {
                $guest = Guest::create([
                    'first_name' => $data['guest_first_name'],
                    'last_name' => $data['guest_last_name'],
                    'email' => $data['guest_email'] ?? null,
                    'phone' => $data['guest_phone'],
                ]);
            }

            // Lock the room row so two concurrent bookings for the same room
            // serialize — the overlap check below then runs after the previous
            // transaction commits (avoids the store() double-booking race).
            $room = Room::whereKey($data['room_id'])->lockForUpdate()->firstOrFail();

            $rate = $room->price_override ?? $room->roomType->base_price;
            $nights = now()->parse($data['check_in'])->diffInDays(now()->parse($data['check_out']));
            $subtotal = $rate * $nights;
            $discount = $subtotal * (($data['discount_percent'] ?? 0) / 100);
            $taxSetting = Setting::where('key', 'tax_rate')->first();
            $taxRate = ((float) ($taxSetting ? $taxSetting->getRawOriginal('value') : '10')) / 100;
            $tax = ($subtotal - $discount) * $taxRate;
            $total = round($subtotal - $discount + $tax, 2);

            $overlap = $this->roomHasOverlap($room->id, $data['check_in'], $data['check_out']);

            if ($overlap) {
                throw ValidationException::withMessages([
                    'room_id' => ['The selected room is not available for the selected dates.'],
                ]);
            }

            $room->update(['status' => 'reserved']);

            return Reservation::createWithNumber([
                'guest_id' => $guest->id,
                'room_id' => $data['room_id'],
                'status' => $data['status'] ?? 'confirmed',
                'check_in' => $data['check_in'],
                'check_out' => $data['check_out'],
                'adults' => $data['adults'],
                'children' => $data['children'] ?? 0,
                'price_per_night' => $rate,
                'total_nights' => $nights,
                'subtotal' => $subtotal,
                'discount_percent' => $data['discount_percent'] ?? 0,
                'discount_amount' => $discount,
                'tax_percent' => $taxRate * 100,
                'tax_amount' => $tax,
                'total_amount' => $total,
                'due_amount' => $total,
                'paid_amount' => 0,
                'source' => $data['source'] ?? null,
                'special_requests' => $data['special_requests'] ?? null,
                'created_by' => $request->user()->id,
            ]);
        });

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'created',
            'module' => 'reservations',
            'model_type' => 'Reservation',
            'model_id' => $reservation->id,
            'description' => "Created reservation #{$reservation->reservation_number}",
        ]);

        return response()->json($reservation->load(['guest', 'room.roomType']), 201);
    }

    public function show(Reservation $reservation)
    {
        return response()->json(
            $reservation->load(['guest', 'room.roomType', 'payments', 'invoices'])
        );
    }

    public function update(Request $request, Reservation $reservation)
    {
        $data = $request->validate([
            'guest_id' => 'sometimes|exists:guests,id',
            'room_id' => 'sometimes|exists:rooms,id',
            'check_in' => 'sometimes|date',
            'check_out' => ['sometimes', 'date', function ($attribute, $value, $fail) use ($reservation, $request) {
                $checkIn = $request->input('check_in') ?? $reservation->check_in;
                if ($value <= $checkIn) {
                    $fail('The check-out date must be after the check-in date.');
                }
            }],
            'adults' => 'sometimes|integer|min:1',
            'children' => 'nullable|integer|min:0',
            'source' => 'nullable|string|max:50',
            'special_requests' => 'nullable|string',
            'price_per_night' => 'nullable|numeric|min:0',
            'discount_percent' => 'nullable|numeric|min:0|max:100',
            'status' => 'sometimes|in:pending,confirmed,checked_in,checked_out,cancelled,no_show',
        ]);

        // The DB column is NOT NULL (default 0); coerce an explicit null so a
        // cleared form field degrades to 0 instead of a 500.
        if (array_key_exists('children', $data) && $data['children'] === null) {
            $data['children'] = 0;
        }

        if (isset($data['status'])) {
            $newStatus = $data['status'];
            $oldStatus = $reservation->status;
            $statusChanged = $newStatus !== $oldStatus;

            // Same-status no-op — allow re-saving without transition validation
            // (edit forms may submit the current status unchanged).
            if (! $statusChanged) {
                unset($data['status']);
            } else {
                $allowedTransitions = [
                    'pending' => ['confirmed', 'checked_in', 'cancelled'],
                    'confirmed' => ['checked_in', 'cancelled', 'no_show'],
                    'checked_in' => ['checked_out'],
                    'checked_out' => [],
                    'cancelled' => [],
                    'no_show' => [],
                ];

                if (! in_array($newStatus, $allowedTransitions[$oldStatus] ?? [])) {
                    return response()->json([
                        'message' => "Cannot change status from {$oldStatus} to {$newStatus}.",
                    ], 422);
                }
            }

            // Audit timestamps only reflect an ACTUAL status change, never a
            // same-status re-save of an edit form.
            if ($statusChanged && $newStatus === 'checked_in') {
                if ($reservation->due_amount > 0 && ! $reservation->hasRecordedPayment()) {
                    return response()->json(['message' => 'Collect a payment before checking in.'], 422);
                }
                $data['checked_in_by'] = $request->user()->id;
                $data['checked_in_at'] = now();
            }

            if ($statusChanged && $newStatus === 'checked_out') {
                if ((float) $reservation->due_amount > 0) {
                    return response()->json(['message' => 'Settle the outstanding balance before checking out.'], 422);
                }
                $data['checked_out_by'] = $request->user()->id;
                $data['checked_out_at'] = now();
            }

            if ($statusChanged && $newStatus === 'no_show') {
                $data['no_show_by'] = $request->user()->id;
                $data['is_overdue'] = false;
            }
        }

        $oldRoomId = $reservation->room_id;
        $newRoomId = isset($data['room_id']) ? (int) $data['room_id'] : $oldRoomId;
        $roomChanged = $newRoomId !== $oldRoomId;
        $datesChanged = isset($data['check_in']) || isset($data['check_out']);
        $pricingChanged = isset($data['price_per_night']) || isset($data['discount_percent']);

        DB::transaction(function () use ($data, $request, $reservation, $newRoomId, $oldRoomId, $roomChanged, $datesChanged, $pricingChanged) {
            if ($roomChanged || $datesChanged) {
                $checkIn = $data['check_in'] ?? $reservation->check_in;
                $checkOut = $data['check_out'] ?? $reservation->check_out;

                $overlap = $this->roomHasOverlap($newRoomId, $checkIn, $checkOut, $reservation->id);

                if ($overlap) {
                    $key = $roomChanged ? 'room_id' : 'check_in';
                    throw ValidationException::withMessages([
                        $key => ['The room is not available for the selected dates.'],
                    ]);
                }
            }

            $reservation->update($data);

            if ($roomChanged) {
                $newRoom = Room::find($newRoomId);
                if ($newRoom) {
                    $reservation->update([
                        'price_per_night' => $newRoom->price_override ?? $newRoom->roomType->base_price,
                    ]);
                }
            }

            if ($roomChanged || $datesChanged || $pricingChanged) {
                $this->recalculatePricing($reservation);
            }

            if ($datesChanged && $reservation->is_overdue
                && !$reservation->check_in->startOfDay()->lt(now()->startOfDay())) {
                $reservation->update(['is_overdue' => false, 'overdue_at' => null]);
            }

            if (isset($data['room_id']) && (int) $data['room_id'] !== $oldRoomId) {
                $oldRoom = Room::find($oldRoomId);
                if ($oldRoom) {
                    $this->reconcileRoomStatus($oldRoom);
                }
            }

            $this->applyRoomState($reservation);
        });

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'updated',
            'module' => 'reservations',
            'model_type' => 'Reservation',
            'model_id' => $reservation->id,
            'description' => "Updated reservation #{$reservation->reservation_number}",
        ]);

        return response()->json($reservation->load(['guest', 'room.roomType']));
    }

    public function destroy(Reservation $reservation)
    {
        if (in_array($reservation->status, ['checked_in', 'checked_out'])) {
            return response()->json(['message' => 'Cannot delete a checked-in or checked-out reservation.'], 422);
        }

        $hasPayments = $reservation->payments()->exists();
        $hasInvoices = $reservation->invoices()->exists();

        if ($hasPayments || $hasInvoices) {
            return response()->json([
                'message' => 'Cannot delete a reservation that has payment or invoice records.',
            ], 422);
        }

        $number = $reservation->reservation_number;

        DB::transaction(function () use ($reservation) {
            $room = $reservation->room;
            $reservation->delete();
            if ($room) {
                $this->reconcileRoomStatus($room);
            }
        });

        ActivityLog::create([
            'user_id' => request()->user()->id,
            'action' => 'deleted',
            'module' => 'reservations',
            'description' => "Deleted reservation #{$number}",
        ]);

        return response()->json(['message' => 'Reservation deleted successfully.']);
    }

    public function checkIn(Request $request, Reservation $reservation)
    {
        if (! in_array($reservation->status, ['confirmed', 'pending'])) {
            return response()->json(['message' => 'Only confirmed or pending reservations can be checked in.'], 422);
        }

        if ($reservation->due_amount > 0 && ! $reservation->hasRecordedPayment()) {
            return response()->json(['message' => 'Collect a payment before checking in.'], 422);
        }

        $reservation->update([
            'status' => 'checked_in',
            'checked_in_by' => $request->user()->id,
            'checked_in_at' => now(),
        ]);

        $reservation->room->update(['status' => 'occupied']);

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'checked_in',
            'module' => 'reservations',
            'model_type' => 'Reservation',
            'model_id' => $reservation->id,
            'description' => "Checked in reservation #{$reservation->reservation_number}",
        ]);

        return response()->json($reservation->load(['guest', 'room.roomType']));
    }

    public function checkOut(Request $request, Reservation $reservation)
    {
        if ($reservation->status !== 'checked_in') {
            return response()->json(['message' => 'Reservation must be checked in to check out.'], 422);
        }

        $data = $request->validate([
            'actual_check_out' => ['nullable', 'date', function ($attribute, $value, $fail) use ($reservation) {
                if (now()->parse($value)->lt(now()->parse($reservation->check_out))) {
                    $fail('Departure date cannot be earlier than the booked check-out.');
                }
            }],
        ]);

        $actualCheckOut = $data['actual_check_out']
            ?? ($reservation->check_out->lt(now()->startOfDay())
                ? now()->toDateString()
                : $reservation->check_out->toDateString());

        $datesChanged = $actualCheckOut !== $reservation->check_out->toDateString();

        // Extending a stay can collide with a following booking for the same
        // room — reject before touching money or dates.
        if ($datesChanged && $this->roomHasOverlap($reservation->room_id, $reservation->check_in, $actualCheckOut, $reservation->id)) {
            return response()->json(['message' => 'The room is already booked for part of the extended stay.'], 422);
        }

        // Same-day late check-out fee applies only when departing on the booked
        // check-out date (no date change). Departures after the booked date bill
        // the actual extra nights instead (datesChanged path), so the flat fee
        // never stacks with them.
        $lateFee = $datesChanged ? 0.0 : $reservation->lateCheckoutFee();

        // Compute the projected balance BEFORE persisting anything, so a blocked
        // check-out leaves the reservation dates/totals untouched (AC-002).
        $paid = $reservation->recordedPaid();
        $currentTotal = $datesChanged
            ? (float) $reservation->computePricing($actualCheckOut)['total_amount']
            : (float) $reservation->total_amount;
        $currentTotal += $lateFee;
        $projectedDue = max(0, $currentTotal - $paid);

        if ($projectedDue > 0) {
            return response()->json(['message' => 'Settle the outstanding balance before checking out.'], 422);
        }

        // Fee folding, date recalc, status change, and room cleanup all happen in
        // ONE transaction, so a failure rolls everything back — a retry recomputes
        // from a clean state and can never double-charge the late fee.
        $userId = $request->user()->id;

        DB::transaction(function () use ($reservation, $actualCheckOut, $datesChanged, $lateFee, $userId) {
            if ($datesChanged) {
                $reservation->update(['check_out' => $actualCheckOut]);
                $this->recalculatePricing($reservation);
            }

            if ($lateFee > 0) {
                $base = $datesChanged
                    ? (float) $reservation->total_amount
                    : (float) $reservation->computePricing($reservation->check_out->toDateString())['total_amount'];
                $reservation->update(['total_amount' => round($base + $lateFee, 2)]);
                $reservation->reconcileBalances();
            }

            $reservation->update([
                'status' => 'checked_out',
                'checked_out_by' => $userId,
                'checked_out_at' => now(),
            ]);

            $reservation->room->update(['status' => 'dirty', 'cleaning_status' => 'dirty']);
        });

        if ($lateFee > 0) {
            ActivityLog::create([
                'user_id' => $request->user()->id,
                'action' => 'late_checkout',
                'module' => 'reservations',
                'model_type' => 'Reservation',
                'model_id' => $reservation->id,
                'description' => "Charged late check-out fee of " . number_format($lateFee, 2) . " for reservation #{$reservation->reservation_number}",
            ]);
        }

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'checked_out',
            'module' => 'reservations',
            'model_type' => 'Reservation',
            'model_id' => $reservation->id,
            'description' => "Checked out reservation #{$reservation->reservation_number}",
        ]);

        return response()->json($reservation->load(['guest', 'room.roomType']));
    }

    public function checkoutPreview(Request $request, Reservation $reservation)
    {
        if ($reservation->status !== 'checked_in') {
            return response()->json(['message' => 'Reservation must be checked in.'], 422);
        }

        $data = $request->validate([
            'actual_check_out' => ['nullable', 'date', function ($attribute, $value, $fail) use ($reservation) {
                if (now()->parse($value)->lt(now()->parse($reservation->check_out))) {
                    $fail('Departure date cannot be earlier than the booked check-out.');
                }
            }],
        ]);

        $actualCheckOut = $data['actual_check_out']
            ?? ($reservation->check_out->lt(now()->startOfDay())
                ? now()->toDateString()
                : $reservation->check_out->toDateString());

        $projected = $reservation->projectedCheckoutTotal($actualCheckOut);
        $overlap = $this->roomHasOverlap(
            $reservation->room_id,
            $reservation->check_in->toDateString(),
            $actualCheckOut,
            $reservation->id
        );

        return response()->json([
            'actual_check_out' => $projected['actual_check_out'],
            'total_nights' => $projected['total_nights'],
            'subtotal' => $projected['subtotal'],
            'discount_amount' => $projected['discount_amount'],
            'tax_percent' => $projected['tax_percent'],
            'tax_amount' => $projected['tax_amount'],
            'total_amount' => $projected['total_amount'],
            'paid_amount' => $projected['paid_amount'],
            'due_amount' => $projected['due_amount'],
            'overlap' => $overlap,
            'late_checkout_fee' => $projected['late_checkout_fee'],
            'late_checkout_applies' => $projected['late_checkout_applies'],
        ]);
    }

    public function cancel(Request $request, Reservation $reservation)
    {
        if (in_array($reservation->status, ['checked_in', 'checked_out', 'cancelled', 'no_show'])) {
            return response()->json(['message' => 'Reservation cannot be cancelled.'], 422);
        }

        $reservation->update([
            'status' => 'cancelled',
        ]);

        $this->reconcileRoomStatus($reservation->room);

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'cancelled',
            'module' => 'reservations',
            'model_type' => 'Reservation',
            'model_id' => $reservation->id,
            'description' => "Cancelled reservation #{$reservation->reservation_number}",
        ]);

        return response()->json($reservation->load(['guest', 'room.roomType']));
    }

    public function markNoShow(Request $request, Reservation $reservation)
    {
        if ($reservation->status !== 'confirmed') {
            return response()->json([
                'message' => 'Only confirmed reservations can be marked as No Show.',
            ], 422);
        }

        $reservation->update([
            'status' => 'no_show',
            'no_show_by' => $request->user()->id,
            'is_overdue' => false,
        ]);

        $this->reconcileRoomStatus($reservation->room);

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'marked_no_show',
            'module' => 'reservations',
            'model_type' => 'Reservation',
            'model_id' => $reservation->id,
            'description' => "Marked reservation #{$reservation->reservation_number} as No Show",
        ]);

        return response()->json($reservation->load(['guest', 'room.roomType']));
    }

    public function refreshOverdue(OverdueReservationService $service)
    {
        $result = $service->detectAndFlagOverdue();

        return response()->json([
            'count' => $result['count'],
            'reservation_ids' => $result['reservation_ids'],
        ]);
    }

    public function extendStay(Request $request, Reservation $reservation)
    {
        if ($reservation->status !== 'checked_in') {
            return response()->json(['message' => 'Only checked-in reservations can be extended.'], 422);
        }

        $data = $request->validate([
            'new_check_out' => ['required', 'date', function ($attribute, $value, $fail) use ($reservation) {
                if (now()->parse($value)->lte(now()->parse($reservation->check_out))) {
                    $fail('The new check-out date must be after the current check-out date.');
                }
            }],
        ]);

        $newCheckOut = $data['new_check_out'];

        $reservationId = $reservation->id;

        $wasBlocked = DB::transaction(function () use ($reservation, $newCheckOut, $reservationId) {
            $overlap = $this->roomHasOverlap(
                $reservation->room_id,
                $reservation->check_in->toDateString(),
                $newCheckOut,
                $reservationId
            );

            if ($overlap) {
                return true;
            }

            $reservation->update(['check_out' => $newCheckOut]);
            $this->recalculatePricing($reservation);

            return false;
        });

        if ($wasBlocked) {
            return response()->json(['message' => 'The room is already reserved for another guest during the extended period.'], 422);
        }

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'extended_stay',
            'module' => 'reservations',
            'model_type' => 'Reservation',
            'model_id' => $reservation->id,
            'description' => "Extended stay for reservation #{$reservation->reservation_number} to {$newCheckOut}",
        ]);

        return response()->json($reservation->fresh()->load(['guest', 'room.roomType']));
    }

    private function recalculatePricing(Reservation $reservation): void
    {
        $pricing = $reservation->computePricing($reservation->check_out->toDateString());

        $reservation->update([
            'total_nights' => $pricing['nights'],
            'subtotal' => $pricing['subtotal'],
            'discount_amount' => $pricing['discount_amount'],
            'tax_percent' => $pricing['tax_percent'],
            'tax_amount' => $pricing['tax_amount'],
            'total_amount' => $pricing['total_amount'],
        ]);

        $reservation->reconcileBalances();
    }

    private function roomHasOverlap(int $roomId, string $checkIn, string $checkOut, ?int $excludeId = null): bool
    {
        return Reservation::where('room_id', $roomId)
            ->overlapping($checkIn, $checkOut)
            ->when($excludeId !== null, fn ($query) => $query->where('id', '!=', $excludeId))
            ->lockForUpdate()
            ->exists();
    }

    private function reconcileRoomStatus(Room $room): void
    {
        $room->reconcileStatus();
    }

    private function applyRoomState(Reservation $reservation): void
    {
        $room = $reservation->room;

        if (! $room) {
            return;
        }

        switch ($reservation->status) {
            case 'cancelled':
            case 'no_show':
                $this->reconcileRoomStatus($room);
                break;
            case 'checked_out':
                $room->update(['status' => 'dirty', 'cleaning_status' => 'dirty']);
                break;
            case 'checked_in':
                $room->update(['status' => 'occupied']);
                break;
            default:
                $room->update(['status' => 'reserved']);
                break;
        }
    }
}
