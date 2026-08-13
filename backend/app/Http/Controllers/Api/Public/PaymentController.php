<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Payment;
use App\Models\Reservation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PaymentController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'reservation_id' => 'required|exists:reservations,id',
            'amount' => 'required|numeric|min:0.01',
            'payment_method' => 'required|in:gcash',
            'payment_type' => 'required|in:full,partial,deposit',
            'reference_number' => 'nullable|string|max:100',
        ]);

        $guest = $request->user();

        $payment = DB::transaction(function () use ($data, $guest) {
            $reservation = Reservation::with('room.roomType')
                ->whereKey($data['reservation_id'])
                ->lockForUpdate()
                ->firstOrFail();

            if ($reservation->guest_id !== $guest->id) {
                throw ValidationException::withMessages([
                    'reservation_id' => ['This reservation does not belong to you.'],
                ]);
            }

            if (in_array($reservation->status, ['cancelled', 'checked_out', 'no_show'])) {
                throw ValidationException::withMessages([
                    'reservation_id' => ['This reservation can no longer be paid.'],
                ]);
            }

            if ($reservation->payment_status === 'paid') {
                throw ValidationException::withMessages([
                    'reservation_id' => ['This reservation is already fully paid.'],
                ]);
            }

            if ($data['amount'] > (float) $reservation->due_amount) {
                throw ValidationException::withMessages([
                    'amount' => ['The amount cannot exceed the outstanding balance of '.number_format((float) $reservation->due_amount, 2).'.'],
                ]);
            }

            $payment = Payment::create([
                'reservation_id' => $reservation->id,
                'guest_id' => $reservation->guest_id,
                'amount' => $data['amount'],
                'payment_method' => $data['payment_method'],
                'payment_type' => $data['payment_type'],
                'reference_number' => $data['reference_number'] ?? null,
                'status' => 'completed',
                'paid_at' => now(),
            ]);

            $reservation->reconcileBalances();

            return $payment;
        });

        ActivityLog::create([
            'user_id' => null,
            'action' => 'created',
            'module' => 'payments',
            'model_type' => 'Payment',
            'model_id' => $payment->id,
            'description' => 'Guest payment of ₱'.number_format($payment->amount, 2)." via {$payment->payment_method} for reservation #{$payment->reservation->reservation_number}",
        ]);

        return response()->json($payment->fresh()->load('reservation.room.roomType'), 201);
    }
}
