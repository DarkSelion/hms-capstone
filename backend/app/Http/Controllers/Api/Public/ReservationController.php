<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Reservation;
use App\Models\Room;
use App\Models\RoomType;
use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReservationController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'room_type_id' => 'required|exists:room_types,id',
            'check_in' => 'required|date|after_or_equal:today',
            'check_out' => 'required|date|after:check_in',
            'adults' => 'required|integer|min:1',
            'children' => 'nullable|integer|min:0',
            'special_requests' => 'nullable|string',
        ]);

        $guest = $request->user();

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
        $rate = (float) $roomType->base_price;
        $nights = now()->parse($data['check_in'])->diffInDays(now()->parse($data['check_out']));
        $nights = max(1, $nights);
        $subtotal = $rate * $nights;
        $taxSetting = Setting::where('key', 'tax_rate')->first();
        $taxRate = ((float)($taxSetting ? $taxSetting->value : '10')) / 100;
        $tax = $subtotal * $taxRate;
        $total = round($subtotal + $tax, 2);

        $reservation = DB::transaction(function () use ($data, $guest, $roomType, $rate, $nights, $subtotal, $tax, $taxRate, $total) {
            $overlappingRoomIds = Reservation::overlapping($data['check_in'], $data['check_out'])->pluck('room_id');

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

            if ($room->capacity && (int) $data['adults'] > (int) $room->capacity) {
                throw ValidationException::withMessages([
                    'adults' => ["The number of adults cannot exceed the room capacity of {$room->capacity}."],
                ]);
            }

            $maxChildren = (int) ($roomType->max_children ?? 0);
            if ($maxChildren > 0 && (int) ($data['children'] ?? 0) > $maxChildren) {
                throw ValidationException::withMessages([
                    'children' => ["The number of children cannot exceed {$maxChildren} for this room type."],
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
            'description' => "Guest {$guest->full_name} created reservation #{$reservation->reservation_number}",
        ]);

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
            'description' => "Guest {$guest->full_name} cancelled reservation #{$reservation->reservation_number}",
        ]);

        return response()->json($reservation->load(['room.roomType']));
    }
}
