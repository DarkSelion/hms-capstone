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

class OnlinePaymentGatewayTest extends TestCase
{
    use RefreshDatabase;

    protected static int $counter = 0;

    // ── Helpers ────────────────────────────────────────────────────────

    protected function enableGateway(array $overrides = []): void
    {
        $defaults = [
            'online_gateway_enabled' => '1',
            'online_gateway_base_url' => 'https://hardreset.onrender.com',
            'online_gateway_api_key' => 'hardreset',
            'online_gateway_webhook_secret' => 'webhook-secret-abc',
        ];

        foreach (array_merge($defaults, $overrides) as $key => $value) {
            Setting::updateOrCreate(
                ['key' => $key],
                ['value' => $value, 'group' => 'payment']
            );
        }
    }

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

    // ── Initiate ───────────────────────────────────────────────────────

    public function test_initiate_requires_guest_authentication(): void
    {
        $this->enableGateway();
        $reservation = $this->reservation();

        $this->postJson('/api/public/payments/initiate-online', ['reservation_id' => $reservation->id])
            ->assertUnauthorized();
    }

    public function test_initiate_requires_gateway_to_be_enabled(): void
    {
        $reservation = $this->reservation();
        Sanctum::actingAs($reservation->guest);

        $this->postJson('/api/public/payments/initiate-online', ['reservation_id' => $reservation->id])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Online payment is not available.');
    }

    public function test_initiate_builds_payload_and_headers(): void
    {
        $this->enableGateway();
        $reservation = $this->reservation();
        Sanctum::actingAs($reservation->guest);

        $reservation->load('room.roomType');

        Http::fake(['*' => Http::response(['payment_url' => 'https://hardreset.onrender.com/pay/session_123'], 200)]);

        $this->postJson('/api/public/payments/initiate-online', ['reservation_id' => $reservation->id])
            ->assertOk()
            ->assertJsonPath('redirect_url', 'https://hardreset.onrender.com/pay/session_123');

        Http::assertSent(function ($request) use ($reservation) {
            return $request->url() === 'https://hardreset.onrender.com/api/initiate-payment'
                && $request->hasHeader('X-API-KEY', 'hardreset')
                && $request['booking_ref'] === $reservation->reservation_number
                && $request['customer_name'] === 'Juan Dela Cruz'
                && $request['customer_email'] === $reservation->guest->email
                && $request['total_amount'] === '2000.00'
                && $request['reservation_id'] === $reservation->id
                && ! isset($request['room_name'])
                && ! isset($request['room_number']);
        });
    }

    public function test_initiate_uses_due_amount_for_partial_reservations(): void
    {
        $this->enableGateway();
        $reservation = $this->reservation();
        $reservation->update(['due_amount' => 750.00, 'paid_amount' => 1250.00, 'payment_status' => 'partial']);
        Sanctum::actingAs($reservation->guest);

        Http::fake(['*' => Http::response(['payment_url' => 'https://hardreset.onrender.com/pay/session_456'], 200)]);

        $this->postJson('/api/public/payments/initiate-online', ['reservation_id' => $reservation->id])
            ->assertOk();

        Http::assertSent(fn ($request) => $request['total_amount'] === '750.00');
    }

    public function test_initiate_rejects_another_guests_reservation(): void
    {
        $this->enableGateway();
        $reservation = $this->reservation();
        $otherGuest = $this->guest(['first_name' => 'Pedro', 'last_name' => 'Santos']);
        Sanctum::actingAs($otherGuest);

        $this->postJson('/api/public/payments/initiate-online', ['reservation_id' => $reservation->id])
            ->assertForbidden();
    }

    public function test_initiate_blocks_already_paid_reservation(): void
    {
        $this->enableGateway();
        $reservation = $this->reservation();
        $reservation->update(['payment_status' => 'paid', 'due_amount' => 0, 'paid_amount' => 2000]);
        Sanctum::actingAs($reservation->guest);

        $this->postJson('/api/public/payments/initiate-online', ['reservation_id' => $reservation->id])
            ->assertStatus(422)
            ->assertJsonPath('message', 'This reservation is already fully paid.');
    }

    public function test_initiate_maps_gateway_auth_error(): void
    {
        $this->enableGateway();
        $reservation = $this->reservation();
        Sanctum::actingAs($reservation->guest);

        Http::fake(['*' => Http::response(['message' => 'invalid api key'], 401)]);

        $this->postJson('/api/public/payments/initiate-online', ['reservation_id' => $reservation->id])
            ->assertStatus(502)
            ->assertJsonPath('message', 'Online payment authorization failed. Please contact the hotel.');
    }

    public function test_initiate_maps_gateway_validation_error(): void
    {
        $this->enableGateway();
        $reservation = $this->reservation();
        Sanctum::actingAs($reservation->guest);

        Http::fake(['*' => Http::response(['message' => 'total_amount mismatch'], 422)]);

        $this->postJson('/api/public/payments/initiate-online', ['reservation_id' => $reservation->id])
            ->assertStatus(422)
            ->assertJsonPath('message', 'The payment provider rejected the request: total_amount mismatch');
    }

    public function test_initiate_maps_gateway_timeout(): void
    {
        $this->enableGateway();
        $reservation = $this->reservation();
        Sanctum::actingAs($reservation->guest);

        Http::fake(['*' => Http::response('', 500)]);

        $this->postJson('/api/public/payments/initiate-online', ['reservation_id' => $reservation->id])
            ->assertStatus(502)
            ->assertJsonPath('message', 'The payment gateway is temporarily unavailable. Please try again later.');
    }

    public function test_initiate_requires_configured_key(): void
    {
        $this->enableGateway(['online_gateway_api_key' => '']);
        $reservation = $this->reservation();
        Sanctum::actingAs($reservation->guest);

        $this->postJson('/api/public/payments/initiate-online', ['reservation_id' => $reservation->id])
            ->assertStatus(503);
    }

    // ── Webhook ────────────────────────────────────────────────────────

    public function test_webhook_returns_503_when_secret_not_configured(): void
    {
        $reservation = $this->reservation();

        $this->postJson('/api/webhooks/payment', [
            'booking_ref' => $reservation->reservation_number,
            'status' => 'paid',
            'amount_paid' => 2000,
        ])->assertStatus(503);
    }

    public function test_webhook_rejects_missing_or_wrong_secret(): void
    {
        $this->enableGateway();
        $reservation = $this->reservation();

        $this->postJson('/api/webhooks/payment', [
            'booking_ref' => $reservation->reservation_number,
            'status' => 'paid',
            'amount_paid' => 2000,
        ])->assertUnauthorized();

        $this->postJson('/api/webhooks/payment', [
            'booking_ref' => $reservation->reservation_number,
            'status' => 'paid',
            'amount_paid' => 2000,
        ], ['X-Webhook-Secret' => 'wrong-secret'])->assertUnauthorized();
    }

    public function test_webhook_paid_creates_completed_payment_and_reconciles(): void
    {
        $this->enableGateway();
        $reservation = $this->reservation();

        $this->postJson('/api/webhooks/payment', [
            'booking_ref' => $reservation->reservation_number,
            'reservation_id' => $reservation->id,
            'status' => 'paid',
            'amount_paid' => 2000,
            'currency' => 'PHP',
        ], ['X-Webhook-Secret' => 'webhook-secret-abc'])
            ->assertOk()
            ->assertJsonPath('received', true);

        $payment = Payment::where('reservation_id', $reservation->id)->firstOrFail();
        $this->assertSame('online', $payment->payment_method);
        $this->assertSame('completed', $payment->status);
        $this->assertSame('full', $payment->payment_type);
        $this->assertEqualsWithDelta(2000, (float) $payment->amount, 0.001);
        $this->assertStringStartsWith('ONLINE-', $payment->reference_number);

        $reservation->refresh();
        $this->assertSame('paid', $reservation->payment_status);
        $this->assertEqualsWithDelta(0, (float) $reservation->due_amount, 0.001);
        $this->assertEqualsWithDelta(2000, (float) $reservation->paid_amount, 0.001);
    }

    public function test_webhook_paid_is_idempotent_for_retried_callbacks(): void
    {
        $this->enableGateway();
        $reservation = $this->reservation();

        $payload = [
            'booking_ref' => $reservation->reservation_number,
            'status' => 'paid',
            'amount_paid' => 2000,
        ];

        $this->postJson('/api/webhooks/payment', $payload, ['X-Webhook-Secret' => 'webhook-secret-abc'])->assertOk();
        $this->postJson('/api/webhooks/payment', $payload, ['X-Webhook-Secret' => 'webhook-secret-abc'])->assertOk();

        $this->assertSame(1, Payment::where('reservation_id', $reservation->id)->count());
        $reservation->refresh();
        $this->assertSame('paid', $reservation->payment_status);
    }

    public function test_webhook_paid_partial_sets_partial(): void
    {
        $this->enableGateway();
        $reservation = $this->reservation();

        $this->postJson('/api/webhooks/payment', [
            'booking_ref' => $reservation->reservation_number,
            'status' => 'paid',
            'amount_paid' => 800,
        ], ['X-Webhook-Secret' => 'webhook-secret-abc'])->assertOk();

        $payment = Payment::where('reservation_id', $reservation->id)->firstOrFail();
        $this->assertSame('partial', $payment->payment_type);

        $reservation->refresh();
        $this->assertSame('partial', $reservation->payment_status);
        $this->assertEqualsWithDelta(1200, (float) $reservation->due_amount, 0.001);
    }

    public function test_webhook_paid_rejects_amount_exceeding_due(): void
    {
        $this->enableGateway();
        $reservation = $this->reservation();

        $this->postJson('/api/webhooks/payment', [
            'booking_ref' => $reservation->reservation_number,
            'status' => 'paid',
            'amount_paid' => 2500,
        ], ['X-Webhook-Secret' => 'webhook-secret-abc'])
            ->assertStatus(422);

        $this->assertSame(0, Payment::where('reservation_id', $reservation->id)->count());
    }

    public function test_webhook_pending_creates_placeholder_and_failed_marks_it(): void
    {
        $this->enableGateway();
        $reservation = $this->reservation();

        $this->postJson('/api/webhooks/payment', [
            'booking_ref' => $reservation->reservation_number,
            'status' => 'pending',
        ], ['X-Webhook-Secret' => 'webhook-secret-abc'])->assertOk();

        $this->assertSame(1, Payment::where('reservation_id', $reservation->id)->where('status', 'pending')->count());

        $this->postJson('/api/webhooks/payment', [
            'booking_ref' => $reservation->reservation_number,
            'status' => 'failed',
        ], ['X-Webhook-Secret' => 'webhook-secret-abc'])->assertOk();

        $this->assertSame(0, Payment::where('reservation_id', $reservation->id)->where('status', 'pending')->count());
        $this->assertSame(1, Payment::where('reservation_id', $reservation->id)->where('status', 'failed')->count());
    }

    public function test_webhook_refunded_flips_completed_payment(): void
    {
        $this->enableGateway();
        $reservation = $this->reservation();

        $this->postJson('/api/webhooks/payment', [
            'booking_ref' => $reservation->reservation_number,
            'status' => 'paid',
            'amount_paid' => 2000,
        ], ['X-Webhook-Secret' => 'webhook-secret-abc'])->assertOk();

        $this->postJson('/api/webhooks/payment', [
            'booking_ref' => $reservation->reservation_number,
            'status' => 'refunded',
        ], ['X-Webhook-Secret' => 'webhook-secret-abc'])->assertOk();

        $payment = Payment::where('reservation_id', $reservation->id)->firstOrFail();
        $this->assertSame('refunded', $payment->status);

        $reservation->refresh();
        $this->assertSame('unpaid', $reservation->payment_status);
        $this->assertEqualsWithDelta(2000, (float) $reservation->due_amount, 0.001);
    }

    public function test_webhook_unknown_reservation_is_rejected(): void
    {
        $this->enableGateway();

        $this->postJson('/api/webhooks/payment', [
            'booking_ref' => 'BK-NOT-REAL',
            'status' => 'paid',
            'amount_paid' => 100,
        ], ['X-Webhook-Secret' => 'webhook-secret-abc'])
            ->assertStatus(422);
    }

    public function test_webhook_rejects_unknown_status(): void
    {
        $this->enableGateway();
        $reservation = $this->reservation();

        $this->postJson('/api/webhooks/payment', [
            'booking_ref' => $reservation->reservation_number,
            'status' => 'bogus',
        ], ['X-Webhook-Secret' => 'webhook-secret-abc'])
            ->assertStatus(422);
    }

    // ── Secret redaction ───────────────────────────────────────────────

    public function test_public_payment_settings_redact_secrets(): void
    {
        $this->enableGateway();

        $response = $this->getJson('/api/public/settings/payment')
            ->assertOk()
            ->assertJsonPath('online_gateway_enabled', '1')
            ->assertJsonPath('online_gateway_base_url', 'https://hardreset.onrender.com');

        $payload = $response->json();
        $this->assertArrayNotHasKey('online_gateway_api_key', $payload, 'Public settings leaked the gateway API key.');
        $this->assertArrayNotHasKey('online_gateway_webhook_secret', $payload, 'Public settings leaked the webhook secret.');
    }

    public function test_admin_payment_settings_include_secrets(): void
    {
        $this->enableGateway();

        $role = Role::create(['name' => 'Administrator', 'slug' => 'admin']);
        $admin = User::create([
            'name' => 'Admin',
            'email' => 'gw-admin@test.com',
            'password' => Hash::make('password'),
            'role_id' => $role->id,
            'is_active' => true,
        ]);
        Sanctum::actingAs($admin);

        $this->getJson('/api/settings/payment')
            ->assertOk()
            ->assertJsonPath('online_gateway_api_key', 'hardreset')
            ->assertJsonPath('online_gateway_webhook_secret', 'webhook-secret-abc');
    }
}