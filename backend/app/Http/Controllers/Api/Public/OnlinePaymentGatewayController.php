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
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
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

        // NOTE: the partner's live server requires `booking_ref` (their DB has a
        // NOT-NULL `booking_ref` column) plus the customer/room fields — their
        // documented spec ({ booking_reference, total_amount }) returns 500.
        // Verified live 2026-08-19; keep this exact shape.
        $payload = [
            'booking_ref' => $reservation->reservation_number,
            'customer_name' => $reservation->guest->full_name,
            'customer_email' => $reservation->guest->email,
            'total_amount' => number_format((float) $reservation->due_amount, 2, '.', ''),
            'reservation_id' => $reservation->id,
            'room_number' => $reservation->room?->room_number,
            'room_name' => $reservation->room?->roomType?->name,
        ];

        try {
            $response = Http::withHeaders(['X-API-KEY' => $apiKey])
                ->acceptJson()
                ->asJson()
                ->timeout(30)
                ->post($baseUrl.'/api/initiate-payment', $payload);
        } catch (ConnectionException $e) {
            Log::warning('Online gateway unreachable', [
                'base_url' => $baseUrl,
                'booking_ref' => $reservation->reservation_number,
                'error' => $e->getMessage(),
            ]);

            return response()->json(['message' => 'The payment gateway is temporarily unavailable. Please try again later.'], 502);
        }

        if ($response->successful()) {
            $paymentUrl = (string) ($response->json('payment_url')
                ?? $response->json('checkout_url')
                ?? $response->json('redirect_url')
                ?? '');

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

        Log::warning('Online gateway upstream error', [
            'base_url' => $baseUrl,
            'booking_ref' => $reservation->reservation_number,
            'status' => $response->status(),
            'body' => mb_substr((string) $response->body(), 0, 500),
        ]);

        return response()->json(['message' => 'The payment gateway is temporarily unavailable. Please try again later.'], 502);
    }

    /**
     * Guest-facing settlement after a checkout redirect back to the portal.
     *
     * The partner gateway verifies the payment and notifies us via webhook in
     * production. This endpoint is a DEMO/fallback path — gated behind the
     * `online_gateway_self_settle` setting (default OFF) so a guest can only
     * self-settle when the hotel explicitly enables it. It reuses the exact
     * same settlement logic as the webhook (recordPaid), gated by guest
     * ownership instead of the shared secret. Amount is always the
     * reservation's own due (never client-supplied) and the call is
     * idempotent (already-paid returns the current state without re-recording).
     */
    public function confirmOnline(Request $request): JsonResponse
    {
        if ((string) Setting::where('key', 'online_gateway_self_settle')->value('value') !== '1') {
            return response()->json(['message' => 'Online payment confirmation is disabled.'], 503);
        }

        $data = $request->validate([
            'reservation_id' => 'required|exists:reservations,id',
        ]);

        $guest = $request->user();

        if (! $guest instanceof Guest) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $reservation = Reservation::with(['room.roomType'])->findOrFail($data['reservation_id']);

        if ($reservation->guest_id !== $guest->id) {
            return response()->json(['message' => 'This reservation does not belong to you.'], 403);
        }

        if (in_array($reservation->status, ['cancelled', 'checked_out', 'no_show'], true)) {
            return response()->json(['message' => 'This reservation can no longer be paid.'], 422);
        }

        $alreadyCompleted = Payment::where('reservation_id', $reservation->id)
            ->where('payment_method', 'online')
            ->where('status', 'completed')
            ->exists();

        if ($reservation->payment_status === 'paid' || (float) $reservation->due_amount <= 0 || $alreadyCompleted) {
            return response()->json([
                'message' => 'This reservation is already fully paid.',
                'reservation' => $reservation->fresh(['room.roomType']),
            ]);
        }

        DB::transaction(function () use ($reservation, $guest) {
            $transactionId = 'PORTAL-'.$reservation->reservation_number.'-'.strtoupper(Str::random(6));

            $this->recordPaid(
                $reservation,
                (float) $reservation->due_amount,
                $transactionId,
                'Guest confirmed online payment of ₱'.number_format((float) $reservation->due_amount, 2).' for reservation #'.$reservation->reservation_number,
            );
        });

        return response()->json([
            'message' => 'Payment confirmed.',
            'reservation' => $reservation->fresh(['room.roomType', 'payments']),
        ]);
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

        Log::info('Payment webhook received', [
            'ip' => $request->ip(),
            'method' => $request->method(),
            'path' => $request->path(),
            'secret_header' => $provided !== '',
            'body' => mb_substr((string) $request->getContent(), 0, 500),
        ]);

        if (! hash_equals($secret, trim($provided))) {
            Log::warning('Payment webhook rejected: invalid secret', ['ip' => $request->ip()]);

            return response()->json(['message' => 'Unauthorized.'], 401);
        }

        // Manual extraction instead of $request->validate(): a framework
        // ValidationException renders as a 302 redirect for clients that
        // don't send Accept: application/json (e.g. PowerShell/curl), which
        // makes partner-side debugging impossible. Every rejection below is
        // an explicit JSON 422.
        $data = [
            'booking_ref' => trim((string) $request->input('booking_ref')),
            'booking_reference' => trim((string) $request->input('booking_reference')),
            'status' => trim((string) $request->input('status')),
            'event' => trim((string) $request->input('event')),
            'amount_paid' => $request->input('amount_paid'),
            'amount' => $request->input('amount'),
            'currency' => trim((string) $request->input('currency')),
            'reservation_id' => $request->input('reservation_id'),
            'transaction_id' => trim((string) $request->input('transaction_id')),
            'payment_id' => trim((string) $request->input('payment_id')),
        ];

        if (empty($data['booking_ref']) && empty($data['booking_reference']) && empty($data['reservation_id'])) {
            Log::warning('Payment webhook rejected: missing booking reference', [
                'body' => mb_substr((string) $request->getContent(), 0, 300),
            ]);

            // Explicit JSON (not a thrown ValidationException) so non-JSON
            // clients like PowerShell/curl always get a parseable 422.
            return response()->json(['message' => 'The booking reference field is required.'], 422);
        }

        if (empty($data['status']) && empty($data['event'])) {
            Log::warning('Payment webhook rejected: missing status/event', [
                'body' => mb_substr((string) $request->getContent(), 0, 300),
            ]);

            return response()->json(['message' => 'The status field is required.'], 422);
        }

        $bookingRef = trim((string) ($data['booking_reference'] ?: $data['booking_ref']));
        $transactionId = trim((string) ($data['transaction_id'] ?: $data['payment_id']));

        $status = strtolower(trim((string) ($data['status'] ?? '')));
        if ($status === '') {
            $status = strtolower(trim((string) ($data['event'] ?? '')));
            if (str_starts_with($status, 'payment.')) {
                $status = substr($status, strlen('payment.'));
            }
        }

        if (! in_array($status, ['pending', 'paid', 'failed', 'expired', 'refunded'], true)) {
            Log::warning('Payment webhook rejected: invalid status', [
                'status' => $status,
                'body' => mb_substr((string) $request->getContent(), 0, 300),
            ]);

            return response()->json(['message' => 'The selected status is invalid.'], 422);
        }

        $amount = (float) ($data['amount_paid'] ?? $data['amount'] ?? 0);

        $reservation = Reservation::where('reservation_number', $bookingRef)->first();

        if (! $reservation && ($data['reservation_id'] ?? null)) {
            $reservation = Reservation::find($data['reservation_id']);
        }

        if (! $reservation) {
            Log::warning('Payment webhook rejected: reservation not found', [
                'booking_ref' => $bookingRef,
                'reservation_id' => $data['reservation_id'] ?? null,
            ]);

            return response()->json(['message' => 'Reservation not found.'], 422);
        }

        try {
            DB::transaction(function () use ($reservation, $status, $amount, $transactionId) {
                switch ($status) {
                    case 'paid':
                        $this->recordPaid($reservation, $amount, $transactionId);
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
            Log::warning('Payment webhook rejected: '.$e->validator->errors()->first(), [
                'reservation' => $reservation->reservation_number,
            ]);

            return response()->json(['message' => $e->validator->errors()->first()], 422);
        }

        Log::info('Payment webhook processed', [
            'reservation' => $reservation->reservation_number,
            'status' => $status,
            'amount' => $amount,
            'transaction_id' => $transactionId,
        ]);

        return response()->json(['received' => true]);
    }

    protected function recordPaid(Reservation $reservation, float $amount, string $transactionId = '', ?string $description = null): void
    {
        $amount = round($amount, 2);

        if ($amount <= 0) {
            Log::warning('Payment webhook rejected: paid amount must be > 0', [
                'reservation' => $reservation->reservation_number,
                'amount' => $amount,
            ]);
            throw ValidationException::withMessages(['amount_paid' => ['The paid amount must be greater than zero.']]);
        }

        // A payment callback for a dead reservation (e.g. it was cancelled after
        // the guest hit Pay Now) must not resurrect financial records — skip it.
        if (in_array($reservation->status, ['cancelled', 'checked_out', 'no_show'], true)) {
            return;
        }

        // Dedupe on the gateway's unique transaction reference when provided
        // (strong idempotency); otherwise fall back to the legacy
        // (reservation, amount) key so retries of the same event can never
        // double-record.
        if ($transactionId !== '') {
            $alreadyRecorded = Payment::where('payment_method', 'online')
                ->where('status', 'completed')
                ->where('reference_number', $transactionId)
                ->where('reservation_id', $reservation->id)
                ->exists();
        } else {
            $alreadyRecorded = Payment::where('reservation_id', $reservation->id)
                ->where('payment_method', 'online')
                ->where('status', 'completed')
                ->where('amount', $amount)
                ->exists();
        }

        if ($alreadyRecorded) {
            return;
        }

        if ($amount > (float) $reservation->due_amount) {
            Log::warning('Payment webhook rejected: amount exceeds balance', [
                'reservation' => $reservation->reservation_number,
                'amount' => $amount,
                'due_amount' => $reservation->due_amount,
            ]);
            throw ValidationException::withMessages([
                'amount_paid' => ['The paid amount exceeds the outstanding balance of '.number_format((float) $reservation->due_amount, 2).'.'],
            ]);
        }

        $payment = Payment::where('reservation_id', $reservation->id)
            ->where('payment_method', 'online')
            ->where('status', 'pending')
            ->latest('id')
            ->first();

        $referenceNumber = $transactionId !== ''
            ? $transactionId
            : 'ONLINE-'.$reservation->reservation_number.'-'.strtoupper(Str::random(6));

        if ($payment) {
            $payment->update([
                'amount' => $amount,
                'payment_type' => $amount >= (float) $reservation->due_amount ? 'full' : 'partial',
                'status' => 'completed',
                'reference_number' => $referenceNumber,
                'paid_at' => now(),
            ]);
        } else {
            $payment = Payment::create([
                'reservation_id' => $reservation->id,
                'guest_id' => $reservation->guest_id,
                'amount' => $amount,
                'payment_method' => 'online',
                'payment_type' => $amount >= (float) $reservation->due_amount ? 'full' : 'partial',
                'status' => 'completed',
                'reference_number' => $referenceNumber,
                'paid_at' => now(),
            ]);
        }

        $reservation->reconcileBalances();

        ActivityLog::create([
            'user_id' => null,
            'action' => 'created',
            'module' => 'payments',
            'model_type' => 'Payment',
            'model_id' => $payment->id,
            'description' => $description ?? ('Guest payment of ₱'.number_format($payment->amount, 2).' via online gateway for reservation #'.$reservation->reservation_number),
        ]);
    }

    protected function recordPending(Reservation $reservation): void
    {
        // Never create a pending payment placeholder on a dead reservation.
        if (in_array($reservation->status, ['cancelled', 'checked_out', 'no_show'], true)) {
            return;
        }

        $alreadyPending = Payment::where('reservation_id', $reservation->id)
            ->where('payment_method', 'online')
            ->where('status', 'pending')
            ->exists();

        $alreadyCompleted = Payment::where('reservation_id', $reservation->id)
            ->where('payment_method', 'online')
            ->where('status', 'completed')
            ->exists();

        if (! $alreadyPending && ! $alreadyCompleted) {
            Payment::create([
                'reservation_id' => $reservation->id,
                'guest_id' => $reservation->guest_id,
                'amount' => (float) $reservation->due_amount,
                'payment_method' => 'online',
                'payment_type' => 'full',
                'status' => 'pending',
                'reference_number' => 'ONLINE-'.$reservation->reservation_number.'-'.strtoupper(Str::random(6)),
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