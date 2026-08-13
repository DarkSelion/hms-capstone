<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Guest;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\Setting;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

class OnlinePaymentGatewayController extends Controller
{
    /**
     * Guest-facing initiate: builds the gateway payload from the reservation,
     * calls the partner /api/initiate-payment endpoint, and returns the
     * payment URL the guest should be redirected to.
     *
     * The gateway key travels in a plain custom header (X-API-KEY), never in
     * the body, and is stored server-side only (redacted from public settings).
     */
    public function initiate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'reservation_id' => 'required|exists:reservations,id',
        ]);

        $guest = $request->user();

        if (! $guest instanceof Guest) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if (! $this->gatewayEnabled()) {
            return response()->json(['message' => 'Online payment is not available.'], 422);
        }

        $baseUrl = rtrim((string) Setting::where('key', 'online_gateway_base_url')->value('value'), '/');
        $apiKey = (string) Setting::where('key', 'online_gateway_api_key')->value('value');

        if ($baseUrl === '' || $apiKey === '') {
            return response()->json(['message' => 'The online payment gateway is not configured. Please contact the hotel.'], 503);
        }

        $reservation = Reservation::with(['room.roomType', 'guest'])
            ->whereKey($data['reservation_id'])
            ->firstOrFail();

        if ($reservation->guest_id !== $guest->id) {
            return response()->json(['message' => 'This reservation does not belong to you.'], 403);
        }

        if (in_array($reservation->status, ['cancelled', 'checked_out', 'no_show'])) {
            return response()->json(['message' => 'This reservation can no longer be paid.'], 422);
        }

        if ($reservation->payment_status === 'paid' || (float) $reservation->due_amount <= 0) {
            return response()->json(['message' => 'This reservation is already fully paid.'], 422);
        }

        $payload = [
            'booking_ref' => $reservation->reservation_number,
            'customer_name' => $reservation->guest->full_name,
            'customer_email' => $reservation->guest->email,
            'total_amount' => number_format((float) $reservation->due_amount, 2, '.', ''),
            'reservation_id' => $reservation->id,
            'room_name' => $reservation->room?->roomType?->name,
            'room_number' => $reservation->room?->room_number,
        ];

        try {
            $response = Http::withHeaders(['X-API-KEY' => $apiKey])
                ->acceptJson()
                ->timeout(30)
                ->post($baseUrl.'/api/initiate-payment', $payload);
        } catch (ConnectionException) {
            return response()->json(['message' => 'The payment gateway is temporarily unavailable. Please try again later.'], 502);
        }

        if ($response->successful()) {
            $paymentUrl = (string) ($response->json('payment_url') ?? $response->json('redirect_url') ?? '');

            if ($paymentUrl === '') {
                return response()->json(['message' => 'The payment gateway returned an invalid response.'], 502);
            }

            return response()->json(['redirect_url' => $paymentUrl]);
        }

        if ($response->status() === 401 || $response->status() === 403) {
            return response()->json(['message' => 'Online payment authorization failed. Please contact the hotel.'], 502);
        }

        if ($response->status() === 400 || $response->status() === 422) {
            $message = (string) ($response->json('message') ?? $response->json('error') ?? '');

            return response()->json([
                'message' => $message !== ''
                    ? 'The payment provider rejected the request: '.mb_substr($message, 0, 200)
                    : 'The payment request was rejected by the payment provider.',
            ], 422);
        }

        return response()->json(['message' => 'The payment gateway is temporarily unavailable. Please try again later.'], 502);
    }

    /**
     * Server-to-server webhook from the payment gateway. Never wrapped in auth
     * middleware — authenticity is enforced with a shared secret header
     * (X-Webhook-Secret). Every status is handled idempotently so retries
     * can never double-record a payment.
     */
    public function webhook(Request $request): JsonResponse
    {
        $secret = (string) Setting::where('key', 'online_gateway_webhook_secret')->value('value');

        if ($secret === '') {
            return response()->json(['message' => 'Webhook is not configured.'], 503);
        }

        $provided = (string) $request->header('X-Webhook-Secret', $request->header('X-Webhook-Signature', ''));

        if (! hash_equals($secret, trim($provided))) {
            return response()->json(['message' => 'Unauthorized.'], 401);
        }

        $data = $request->validate([
            'booking_ref' => 'required|string|max:50',
            'status' => 'required|in:pending,paid,failed,expired,refunded',
            'amount_paid' => 'nullable|numeric|min:0',
            'currency' => 'nullable|string|max:10',
            'reservation_id' => 'nullable|integer',
        ]);

        $reservation = Reservation::where('reservation_number', $data['booking_ref'])->first();

        if (! $reservation && ($data['reservation_id'] ?? null)) {
            $reservation = Reservation::find($data['reservation_id']);
        }

        if (! $reservation) {
            return response()->json(['message' => 'Reservation not found.'], 422);
        }

        try {
            DB::transaction(function () use ($reservation, $data) {
                switch ($data['status']) {
                    case 'paid':
                        $this->recordPaid($reservation, (float) $data['amount_paid']);
                        break;

                    case 'pending':
                        $this->recordPending($reservation);
                        break;

                    case 'failed':
                    case 'expired':
                        $this->failPending($reservation);
                        break;

                    case 'refunded':
                        $this->recordRefund($reservation);
                        break;
                }
            });
        } catch (ValidationException $e) {
            return response()->json(['message' => $e->validator->errors()->first()], 422);
        }

        return response()->json(['received' => true]);
    }

    protected function recordPaid(Reservation $reservation, float $amount): void
    {
        $amount = round($amount, 2);

        if ($amount <= 0) {
            throw ValidationException::withMessages(['amount_paid' => ['The paid amount must be greater than zero.']]);
        }

        $alreadyRecorded = Payment::where('reservation_id', $reservation->id)
            ->where('payment_method', 'online')
            ->where('status', 'completed')
            ->where('amount', $amount)
            ->exists();

        if ($alreadyRecorded) {
            return;
        }

        if ($amount > (float) $reservation->due_amount) {
            throw ValidationException::withMessages([
                'amount_paid' => ['The paid amount exceeds the outstanding balance of '.number_format((float) $reservation->due_amount, 2).'.'],
            ]);
        }

        $payment = Payment::create([
            'reservation_id' => $reservation->id,
            'guest_id' => $reservation->guest_id,
            'amount' => $amount,
            'payment_method' => 'online',
            'payment_type' => $amount >= (float) $reservation->due_amount ? 'full' : 'partial',
            'status' => 'completed',
            'reference_number' => 'ONLINE-'.$reservation->reservation_number,
            'paid_at' => now(),
        ]);

        $reservation->reconcileBalances();

        ActivityLog::create([
            'user_id' => null,
            'action' => 'created',
            'module' => 'payments',
            'model_type' => 'Payment',
            'model_id' => $payment->id,
            'description' => 'Guest payment of ₱'.number_format($payment->amount, 2).' via online gateway for reservation #'.$reservation->reservation_number,
        ]);
    }

    protected function recordPending(Reservation $reservation): void
    {
        $alreadyPending = Payment::where('reservation_id', $reservation->id)
            ->where('payment_method', 'online')
            ->where('status', 'pending')
            ->exists();

        if (! $alreadyPending) {
            Payment::create([
                'reservation_id' => $reservation->id,
                'guest_id' => $reservation->guest_id,
                'amount' => (float) $reservation->due_amount,
                'payment_method' => 'online',
                'payment_type' => 'full',
                'status' => 'pending',
                'reference_number' => 'ONLINE-'.$reservation->reservation_number,
            ]);
        }
    }

    protected function failPending(Reservation $reservation): void
    {
        Payment::where('reservation_id', $reservation->id)
            ->where('payment_method', 'online')
            ->where('status', 'pending')
            ->update(['status' => 'failed']);
    }

    protected function recordRefund(Reservation $reservation): void
    {
        $payment = Payment::where('reservation_id', $reservation->id)
            ->where('payment_method', 'online')
            ->where('status', 'completed')
            ->latest('id')
            ->first();

        if (! $payment) {
            return;
        }

        $payment->update(['status' => 'refunded']);
        $reservation->reconcileBalances();

        ActivityLog::create([
            'user_id' => null,
            'action' => 'refunded',
            'module' => 'payments',
            'model_type' => 'Payment',
            'model_id' => $payment->id,
            'description' => 'Refund of ₱'.number_format($payment->amount, 2).' via online gateway for reservation #'.$reservation->reservation_number,
        ]);
    }

    protected function gatewayEnabled(): bool
    {
        return (string) Setting::where('key', 'online_gateway_enabled')->value('value') === '1';
    }
}