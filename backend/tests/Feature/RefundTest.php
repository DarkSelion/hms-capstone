<?php

namespace Tests\Feature;

use App\Models\Guest;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\Room;
use App\Models\RoomType;
use App\Models\Setting;
use App\Models\User;
use App\Models\Role;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RefundTest extends TestCase
{
    use RefreshDatabase;

    protected static int $counter = 0;

    // ── Helpers ────────────────────────────────────────────────────────

    protected function guest(array $overrides = []): Guest
    {
        self::$counter++;

        return Guest::create(array_merge([
            'first_name' => 'Juan',
            'last_name' => 'Dela Cruz',
            'email' => 'juan'.self::$counter.'@example.com',
            'phone' => '0917123456'.self::$counter,
            'password' => Hash::make('password'),
        ], $overrides));
    }

    protected function roomType(): RoomType
    {
        return RoomType::create([
            'name' => 'Deluxe King',
            'slug' => 'deluxe-king-'.(++self::$counter),
            'base_price' => 1000,
        ]);
    }

    protected function room(): Room
    {
        $type = $this->roomType();

        return Room::create([
            'room_number' => '30'.self::$counter,
            'room_type_id' => $type->id,
            'floor' => 3,
            'status' => 'available',
            'capacity' => 2,
            'is_active' => true,
        ]);
    }

    protected function reservation(?Room $room = null): Reservation
    {
        $bookingGuest = $this->guest();
        $room = $room ?? $this->room();
        $id = Reservation::max('id') ?? 0;

        return Reservation::create([
            'reservation_number' => 'BK-2026-'.str_pad((string) ($id + 1), 4, '0', STR_PAD_LEFT).'-TEST',
            'guest_id' => $bookingGuest->id,
            'room_id' => $room->id,
            'status' => 'confirmed',
            'check_in' => '2026-10-10',
            'check_out' => '2026-10-12',
            'adults' => 2,
            'children' => 0,
            'price_per_night' => 1000,
            'total_nights' => 2,
            'subtotal' => 2000,
            'total_amount' => 2000,
            'due_amount' => 2000,
            'paid_amount' => 0,
            'discount_percent' => 0,
            'discount_amount' => 0,
            'tax_percent' => 0,
            'tax_amount' => 0,
            'payment_status' => 'unpaid',
            'source' => 'direct',
        ]);
    }

    protected function staff(array $overrides = []): User
    {
        $role = Role::firstOrCreate(['slug' => 'admin'], ['name' => 'Admin']);

        $user = User::create(array_merge([
            'name' => 'Staff Member',
            'email' => 'staff'.self::$counter.'@hotel.com',
            'password' => Hash::make('password'),
            'role_id' => $role->id,
        ], $overrides));

        Sanctum::actingAs($user);

        return $user;
    }

    protected function completedPayment(Reservation $reservation, string $method = 'cash', float $amount = 2000): Payment
    {
        return Payment::create([
            'reservation_id' => $reservation->id,
            'guest_id' => $reservation->guest_id,
            'amount' => $amount,
            'payment_method' => $method,
            'payment_type' => 'full',
            'status' => 'completed',
            'reference_number' => strtoupper($method).'-'.str_pad((string) (Payment::max('id') + 1), 5, '0', STR_PAD_LEFT),
            'paid_at' => now(),
        ]);
    }

    // ── Local refund (cash / gcash) ───────────────────────────────────

    public function test_cash_refund_records_locally(): void
    {
        $this->staff();
        $reservation = $this->reservation();
        $payment = $this->completedPayment($reservation, 'cash', 1500);

        $this->postJson("/api/payments/{$payment->id}/refund", [
            'amount' => 1500,
            'reason' => 'Guest requested cancellation',
        ])->assertOk()
          ->assertJsonPath('message', 'Refund recorded successfully.')
          ->assertJsonPath('amount', 1500);

        $payment->refresh();
        $this->assertSame('refund', $payment->payment_type);
        $this->assertSame('refunded', $payment->status);
        $this->assertStringContainsString('Guest requested cancellation', $payment->notes);
    }

    public function test_gcash_refund_records_locally(): void
    {
        $this->staff();
        $reservation = $this->reservation();
        $payment = $this->completedPayment($reservation, 'gcash', 800);

        $this->postJson("/api/payments/{$payment->id}/refund", [
            'amount' => 800,
            'reason' => 'Overcharge correction',
        ])->assertOk()
          ->assertJsonPath('message', 'Refund recorded successfully.');

        $payment->refresh();
        $this->assertSame('refund', $payment->payment_type);
        $this->assertSame('refunded', $payment->status);
    }

    public function test_local_refund_reconciles_reservation_balances(): void
    {
        $this->staff();
        $reservation = $this->reservation();
        $payment = $this->completedPayment($reservation, 'cash', 2000);

        // Simulate the reservation having paid_amount = 2000
        $reservation->update(['paid_amount' => 2000, 'due_amount' => 0, 'payment_status' => 'paid']);

        $this->postJson("/api/payments/{$payment->id}/refund", [
            'amount' => 2000,
            'reason' => 'Full refund',
        ])->assertOk();

        $reservation->refresh();
        $this->assertSame(0.0, (float) $reservation->paid_amount);
        $this->assertSame(2000.0, (float) $reservation->due_amount);
    }

    public function test_local_refund_logs_activity(): void
    {
        $this->staff();
        $reservation = $this->reservation();
        $payment = $this->completedPayment($reservation, 'cash', 500);

        $this->postJson("/api/payments/{$payment->id}/refund", [
            'amount' => 500,
            'reason' => 'Service issue',
        ])->assertOk();

        $this->assertDatabaseHas('activity_logs', [
            'action' => 'refunded',
            'module' => 'payments',
            'model_type' => 'Payment',
            'model_id' => $payment->id,
        ]);
    }

    // ── Online refund (gateway) ───────────────────────────────────────

    public function test_online_refund_calls_gateway(): void
    {
        $this->staff();
        Setting::updateOrCreate(['key' => 'online_gateway_base_url'], ['value' => 'https://www.hardreset.club', 'group' => 'payment']);
        Setting::updateOrCreate(['key' => 'online_gateway_api_key'], ['value' => 'REDACTED_GATEWAY_KEY', 'group' => 'payment']);

        $reservation = $this->reservation();
        $payment = $this->completedPayment($reservation, 'online', 2000);

        Http::fake(['*' => Http::response(['refund_id' => 'REF-12345', 'paymongo_refund_id' => 're_abc'], 200)]);

        $this->postJson("/api/payments/{$payment->id}/refund", [
            'amount' => 2000,
            'reason' => 'Duplicate charge',
        ])->assertOk()
          ->assertJsonPath('message', 'Refund processed successfully via gateway.')
          ->assertJsonPath('refund_id', 'REF-12345');

        Http::assertSent(function ($request) {
            return $request->url() === 'https://www.hardreset.club/api/refund'
                && $request->hasHeader('X-API-KEY', 'REDACTED_GATEWAY_KEY')
                && $request['refund_status'] === 'initiated';
        });

        $payment->refresh();
        $this->assertSame('refund', $payment->payment_type);
        $this->assertSame('refunded', $payment->status);
        $this->assertSame('REF-12345', $payment->reference_number);
        $this->assertSame('re_abc', $payment->transaction_id);
    }

    public function test_online_refund_returns_502_on_gateway_timeout(): void
    {
        $this->staff();
        Setting::updateOrCreate(['key' => 'online_gateway_base_url'], ['value' => 'https://www.hardreset.club', 'group' => 'payment']);
        Setting::updateOrCreate(['key' => 'online_gateway_api_key'], ['value' => 'REDACTED_GATEWAY_KEY', 'group' => 'payment']);

        $reservation = $this->reservation();
        $payment = $this->completedPayment($reservation, 'online', 1000);

        Http::fake(['*' => Http::response(null, 500)]);

        $this->postJson("/api/payments/{$payment->id}/refund", [
            'amount' => 1000,
            'reason' => 'Test timeout',
        ])->assertStatus(502);
    }

    public function test_online_refund_passes_through_gateway_422(): void
    {
        $this->staff();
        Setting::updateOrCreate(['key' => 'online_gateway_base_url'], ['value' => 'https://www.hardreset.club', 'group' => 'payment']);
        Setting::updateOrCreate(['key' => 'online_gateway_api_key'], ['value' => 'REDACTED_GATEWAY_KEY', 'group' => 'payment']);

        $reservation = $this->reservation();
        $payment = $this->completedPayment($reservation, 'online', 1000);

        Http::fake(['*' => Http::response(['message' => 'Payment not found'], 422)]);

        $this->postJson("/api/payments/{$payment->id}/refund", [
            'amount' => 1000,
            'reason' => 'Test gateway error',
        ])->assertStatus(422)
          ->assertJsonPath('message', 'Gateway rejected: Payment not found');
    }

    // ── Shared validation ─────────────────────────────────────────────

    public function test_refund_rejected_on_pending_payment(): void
    {
        $this->staff();
        $reservation = $this->reservation();
        $payment = Payment::create([
            'reservation_id' => $reservation->id,
            'guest_id' => $reservation->guest_id,
            'amount' => 1000,
            'payment_method' => 'cash',
            'payment_type' => 'partial',
            'status' => 'pending',
        ]);

        $this->postJson("/api/payments/{$payment->id}/refund", [
            'amount' => 500,
            'reason' => 'Test',
        ])->assertStatus(422)
          ->assertJsonPath('message', 'Only completed payments can be refunded.');
    }

    public function test_refund_rejected_when_amount_exceeds_max(): void
    {
        $this->staff();
        $reservation = $this->reservation();
        $payment = $this->completedPayment($reservation, 'cash', 1000);

        // Record a partial refund first
        Payment::create([
            'reservation_id' => $reservation->id,
            'guest_id' => $reservation->guest_id,
            'amount' => 600,
            'payment_method' => 'cash',
            'payment_type' => 'refund',
            'status' => 'completed',
        ]);

        $this->postJson("/api/payments/{$payment->id}/refund", [
            'amount' => 500,
            'reason' => 'Exceeds max',
        ])->assertStatus(422)
          ->assertJsonPath('message', fn (string $msg) => str_contains($msg, 'cannot exceed'));
    }

    public function test_refund_requires_auth(): void
    {
        $reservation = $this->reservation();
        $payment = $this->completedPayment($reservation, 'cash', 1000);

        $this->postJson("/api/payments/{$payment->id}/refund", [
            'amount' => 500,
            'reason' => 'Test',
        ])->assertUnauthorized();
    }

    public function test_guest_cannot_refund(): void
    {
        $reservation = $this->reservation();
        $payment = $this->completedPayment($reservation, 'cash', 1000);
        Sanctum::actingAs($reservation->guest);

        $this->postJson("/api/payments/{$payment->id}/refund", [
            'amount' => 500,
            'reason' => 'Test',
        ])->assertForbidden();
    }

    public function test_refund_validates_required_fields(): void
    {
        $this->staff();
        $reservation = $this->reservation();
        $payment = $this->completedPayment($reservation, 'cash', 1000);

        $this->postJson("/api/payments/{$payment->id}/refund", [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['amount', 'reason']);
    }
}
