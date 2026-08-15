<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Payment;
use App\Models\Reservation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PaymentController extends Controller
{
    public function index(Request $request)
    {
        $query = Payment::with(['reservation.guest', 'reservation.room.roomType']);

        if ($search = $request->search) {
            $query->where(function ($q) use ($search) {
                $q->where('reference_number', 'like', "%{$search}%")
                    ->orWhereHas('reservation.guest', function ($gq) use ($search) {
                        $gq->where('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%");
                    });
            });
        }

        if ($method = $request->payment_method) {
            $query->where('payment_method', $method);
        }

        if ($status = $request->status) {
            $query->where('status', $status);
        }

        if ($from = $request->date_from) {
            $query->where('created_at', '>=', $from . ' 00:00:00');
        }

        if ($to = $request->date_to) {
            $query->where('created_at', '<=', $to . ' 23:59:59');
        }

        $sort = $request->sort ?? '-created_at';
        $dir = $sort[0] === '-' ? 'desc' : 'asc';
        $field = ltrim($sort, '-');
        $allowed = ['created_at', 'paid_at', 'amount', 'status', 'payment_method', 'reference_number'];
        if (in_array($field, $allowed)) {
            $query->orderBy($field, $dir);
        } else {
            $query->orderBy('created_at', 'desc');
        }

        return response()->json(
            $query->paginate($request->per_page ?? 10)
        );
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'reservation_id' => 'required|exists:reservations,id',
            'amount' => 'required|numeric|min:0.01',
            'payment_method' => 'required|in:cash,gcash,online',
            'payment_type' => 'required|in:full,partial,deposit',
            'status' => 'sometimes|in:pending,completed,failed,refunded',
            'reference_number' => 'nullable|string|max:100',
            'notes' => 'nullable|string',
            'actual_check_out' => 'nullable|date',
        ]);

        $payment = DB::transaction(function () use ($data, $request) {
            $reservation = Reservation::whereKey($data['reservation_id'])->lockForUpdate()->firstOrFail();

            if (in_array($reservation->status, ['cancelled', 'checked_out', 'no_show'])) {
                throw ValidationException::withMessages([
                    'reservation_id' => ['Payments cannot be recorded on a '.$reservation->status.' reservation.'],
                ]);
            }

            // The check-out collect flow collects the PROJECTED balance (extra
            // nights from a changed departure and/or the same-day late fee),
            // which has not been persisted to the reservation yet. When the
            // caller supplies the actual departure date, cap the amount at the
            // projected balance due; otherwise keep the stored balance cap.
            $maxAmount = (float) $reservation->due_amount;
            if (! empty($data['actual_check_out'])) {
                $projected = $reservation->projectedCheckoutTotal($data['actual_check_out']);
                $maxAmount = max($maxAmount, (float) $projected['due_amount']);
            }

            if ($data['amount'] > $maxAmount) {
                throw ValidationException::withMessages([
                    'amount' => ['The amount cannot exceed the outstanding balance of '.number_format($maxAmount, 2).'.'],
                ]);
            }

            $data['guest_id'] = $reservation->guest_id;
            $data['paid_at'] = now();

            if (!isset($data['status'])) {
                $data['status'] = 'completed';
            }

            if (empty($data['reference_number'])) {
                $data['reference_number'] = 'PAY-' . now()->format('Ymd') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));
            }

            unset($data['actual_check_out']);

            $payment = Payment::create($data);

            if ($data['status'] === 'completed' && $reservation->status === 'pending') {
                $reservation->update(['status' => 'confirmed']);
            }

            $reservation->reconcileBalances();

            return $payment;
        });

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'created',
            'module' => 'payments',
            'model_type' => 'Payment',
            'model_id' => $payment->id,
            'description' => "Recorded payment of ₱" . number_format($payment->amount, 2) . " for reservation #" . $payment->reservation->reservation_number,
        ]);

        return response()->json($payment->load(['reservation.guest', 'reservation.room.roomType']), 201);
    }

    public function show(Payment $payment)
    {
        return response()->json($payment->load(['reservation.guest', 'reservation.room.roomType']));
    }

    public function update(Request $request, Payment $payment)
    {
        $data = $request->validate([
            'payment_method' => 'sometimes|in:cash,gcash,online',
            'status' => 'sometimes|in:pending,completed,failed,refunded',
            'reference_number' => 'nullable|string|max:100',
            'notes' => 'nullable|string',
        ]);

        $payment->update($data);

        if (in_array('status', array_keys($data))) {
            DB::transaction(function () use ($payment, $data) {
                $reservation = Reservation::whereKey($payment->reservation_id)->lockForUpdate()->firstOrFail();

                if ($data['status'] === 'completed' && $reservation->status === 'pending') {
                    $reservation->update(['status' => 'confirmed']);
                }

                $reservation->reconcileBalances();

                return $reservation;
            });
        }

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'updated',
            'module' => 'payments',
            'model_type' => 'Payment',
            'model_id' => $payment->id,
            'description' => "Updated payment #{$payment->id} status to {$payment->status}",
        ]);

        return response()->json($payment->load(['reservation.guest', 'reservation.room.roomType']));
    }

    public function destroy(Payment $payment)
    {
        return response()->json(['message' => 'Payments cannot be deleted.'], 422);
    }
}
