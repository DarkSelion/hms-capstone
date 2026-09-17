<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Reservation;
use App\Models\Room;
use App\Models\RoomType;
use App\Models\Setting;
use Illuminate\Http\Request;
use App\Mail\BookingConfirmationMail;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

class ReservationController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'room_type_id' => 'required|exists:room_types,id',
            'room_id' => 'nullable|exists:rooms,id',
            'check_in' => 'required|date|after_or_equal:today',
            'check_out' => 'required|date|after:check_in',
            'adults' => 'required|integer|min:1',
            'children' => 'nullable|integer|min:0',
            'special_requests' => 'nullable|string',
            'cancellation_tier' => 'nullable|string|in:flexible,non_refundable',
        ]);

        $guest = $request->user();

        // Require verified email before booking
        if (! $guest->email_verified_at) {
            return response()->json([
                'message' => 'Please verify your email address before making a reservation. Check your inbox for the verification link.',
                'requires_verification' => true,
            ], 403);
        }

        $maxAdvanceDays = (int) (Setting::where('key', 'max_advance_days')->value('value') ?? 30);
        if ($maxAdvanceDays > 0) {
            $latest = now()->addDays($maxAdvanceDays)->startOfDay();
            if (now()->parse($data['check_in'])->gt($latest)) {
                throw ValidationException::withMessages([
                    'check_in' => ["Bookings can be made up to {$maxAdvanceDays} days in advance."],
                ]);
            }
        }

        $roomType = RoomType::findOrFail($data['room_type_id']);
        $nights = now()->parse($data['check_in'])->diffInDays(now()->parse($data['check_out']));
        $nights = max(1, $nights);

        $reservation = DB::transaction(function () use ($data, $guest, $roomType, $nights) {
            $overlappingRoomIds = Reservation::overlapping($data['check_in'], $data['check_out'])->pluck('room_id');

            // If guest picked a specific room, try to use it; otherwise auto-assign the first available.
            $room = null;
            if (!empty($data['room_id'])) {
                $room = Room::where('id', $data['room_id'])
                    ->where('room_type_id', $roomType->id)
                    ->where('is_active', true)
                    ->lockForUpdate()
                    ->first();
                if (!$room) {
                    throw ValidationException::withMessages([
                        'room_id' => ['Selected room does not match the chosen room type.'],
                    ]);
                }
                if ($overlappingRoomIds->contains($room->id)) {
                    throw ValidationException::withMessages([
                        'room_id' => ['Selected room is already booked for those dates.'],
                    ]);
                }
            } else {
                $room = Room::where('room_type_id', $roomType->id)
                    ->where('status', 'available')
                    ->where('is_active', true)
                    ->whereNotIn('id', $overlappingRoomIds)
                    ->orderBy('floor')
                    ->orderBy('room_number')
                    ->lockForUpdate()
                    ->first();

                if (!$room) {
                    throw ValidationException::withMessages([
                        'room_type_id' => ['No rooms of this type are available for the selected dates.'],
                    ]);
                }
            }

            // Rate: room price_override wins when set, else room type base price
            $rate = $room->price_override !== null && $room->price_override !== ''
                ? (float) $room->price_override
                : (float) $roomType->base_price;

            // Apply non-refundable discount if selected
            $cancellationTier = $data['cancellation_tier'] ?? 'flexible';
            if ($cancellationTier === 'non_refundable' && (float) ($roomType->non_refundable_discount ?? 0) > 0) {
                $rate = round($rate * (1 - (float) $roomType->non_refundable_discount / 100), 2);
            }

            $subtotal = $rate * $nights;
            $taxSetting = Setting::where('key', 'tax_rate')->first();
            $taxRate = ((float)($taxSetting ? $taxSetting->value : '10')) / 100;
            $tax = $subtotal * $taxRate;
            $total = round($subtotal + $tax, 2);

            $maxAdults = (int) ($roomType->max_adults ?? 0);
            if ($maxAdults > 0 && (int) $data['adults'] > $maxAdults) {
                throw ValidationException::withMessages([
                    'adults' => ["{$roomType->name} accommodates up to {$maxAdults} adults."],
                ]);
            }

            $maxChildren = (int) ($roomType->max_children ?? 0);
            if ($maxChildren > 0 && (int) ($data['children'] ?? 0) > $maxChildren) {
                throw ValidationException::withMessages([
                    'children' => ["The number of children cannot exceed {$maxChildren} for this room type."],
                ]);
            }

            $totalGuests = (int) $data['adults'] + (int) ($data['children'] ?? 0);
            if ($room->capacity && $totalGuests > (int) $room->capacity) {
                throw ValidationException::withMessages([
                    'adults' => ["Total guests (adults + children) cannot exceed this room's capacity of {$room->capacity}."],
                ]);
            }

            $reservation = Reservation::createWithNumber([
                'guest_id' => $guest->id,
                'room_id' => $room->id,
                'status' => 'confirmed',
                'check_in' => $data['check_in'],
                'check_out' => $data['check_out'],
                'adults' => $data['adults'],
                'children' => $data['children'] ?? 0,
                'price_per_night' => $rate,
                'total_nights' => $nights,
                'subtotal' => $subtotal,
                'discount_percent' => 0,
                'discount_amount' => 0,
                'tax_percent' => $taxRate * 100,
                'tax_amount' => $tax,
                'total_amount' => $total,
                'paid_amount' => 0,
                'due_amount' => $total,
                'payment_status' => 'unpaid',
                'special_requests' => $data['special_requests'] ?? null,
                'source' => 'booking_engine',
                'cancellation_tier' => $cancellationTier,
            ]);

            $room->update(['status' => 'reserved']);

            return $reservation;
        });

        ActivityLog::create([
            'user_id' => null,
            'action' => 'created',
            'module' => 'reservations',
            'model_type' => 'Reservation',
            'model_id' => $reservation->id,
            'description' => "Guest " . \App\Helpers\DataMasker::maskName($guest->full_name) . " created reservation #{$reservation->reservation_number}",
        ]);

        try {
            Mail::to($guest->email)->send(new BookingConfirmationMail($reservation));
        } catch (\Exception $e) {
            // Don't fail the booking if email fails
        }

        return response()->json(
            $reservation->load(['guest', 'room.roomType']),
            201
        );
    }

    public function index(Request $request)
    {
        $guest = $request->user();

        $reservations = Reservation::where('guest_id', $guest->id)
            ->with(['room.roomType'])
            ->orderBy('created_at', 'desc')
            ->paginate($request->per_page ?? 10);

        return response()->json($reservations);
    }

    public function show(Request $request, Reservation $reservation)
    {
        $guest = $request->user();

        if ($reservation->guest_id !== $guest->id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        return response()->json(
            $reservation->load(['room.roomType', 'payments'])
        );
    }

    public function cancel(Request $request, Reservation $reservation)
    {
        $guest = $request->user();

        if ($reservation->guest_id !== $guest->id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        if (in_array($reservation->status, ['checked_in', 'checked_out', 'cancelled', 'no_show'])) {
            return response()->json(['message' => 'Reservation cannot be cancelled.'], 422);
        }

        if ($reservation->cancellation_tier === 'non_refundable') {
            return response()->json(['message' => 'This is a non-refundable reservation and cannot be cancelled.'], 422);
        }

        DB::transaction(function () use ($reservation) {
            $reservation->update([
                'status' => 'cancelled',
            ]);

            $room = $reservation->room;
            if ($room) {
                $room->reconcileStatus();
            }
        });

        ActivityLog::create([
            'user_id' => null,
            'action' => 'cancelled',
            'module' => 'reservations',
            'model_type' => 'Reservation',
            'model_id' => $reservation->id,
            'description' => "Guest " . \App\Helpers\DataMasker::maskName($guest->full_name) . " cancelled reservation #{$reservation->reservation_number}",
        ]);

        return response()->json($reservation->load(['room.roomType']));
    }

    public function refundRequest(Request $request, Reservation $reservation)
    {
        $guest = $request->user();

        if ($reservation->guest_id !== $guest->id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        if (in_array($reservation->status, ['cancelled', 'checked_out', 'no_show'])) {
            return response()->json(['message' => 'Cannot request a refund for this reservation.'], 422);
        }

        if ($reservation->payment_status !== 'paid') {
            return response()->json(['message' => 'Refund requests are only available for fully paid reservations.'], 422);
        }

        if ($reservation->refund_requested_at !== null) {
            return response()->json(['message' => 'A refund request has already been submitted for this reservation.'], 422);
        }

        $data = $request->validate([
            'reason' => 'required|string|max:500',
        ]);

        $reservation->update(['refund_requested_at' => now()]);

        ActivityLog::create([
            'user_id' => null,
            'action' => 'refund_requested',
            'module' => 'reservations',
            'model_type' => 'Reservation',
            'model_id' => $reservation->id,
            'description' => "Guest " . \App\Helpers\DataMasker::maskName($guest->full_name) . " requested a refund for reservation #{$reservation->reservation_number} — Reason: {$data['reason']}",
        ]);

        return response()->json([
            'message' => 'Refund request submitted. Our team will review it shortly.',
            'reservation' => $reservation->fresh()->load(['room.roomType']),
        ]);
    }
}
