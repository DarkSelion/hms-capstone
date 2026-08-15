<?php

namespace Tests\Feature;

use App\Models\Guest;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\Role;
use App\Models\Room;
use App\Models\RoomType;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SecurityHardeningTest extends TestCase
{
    use RefreshDatabase;

    protected function admin(): User
    {
        $role = Role::create(['name' => 'Administrator', 'slug' => 'admin']);

        return User::create([
            'name' => 'Admin User',
            'email' => 'admin@test.com',
            'password' => Hash::make('password'),
            'role_id' => $role->id,
        ]);
    }

    protected function guest(array $overrides = []): Guest
    {
        return Guest::create(array_merge([
            'first_name' => 'John',
            'last_name' => 'Travolta',
            'email' => 'john@example.com',
            'phone' => '09171234567',
            'password' => Hash::make('password'),
        ], $overrides));
    }

    protected function roomType(string $slug = 'deluxe', ?float $price = 150): RoomType
    {
        return RoomType::create([
            'name' => ucfirst($slug),
            'slug' => $slug . '-' . uniqid(),
            'description' => 'A nice room',
            'base_price' => $price,
            'capacity' => 2,
            'max_adults' => 2,
            'max_children' => 1,
            'is_active' => true,
            'sort_order' => 1,
        ]);
    }

    protected function room(RoomType $type, array $overrides = []): Room
    {
        return Room::create(array_merge([
            'room_number' => uniqid('R'),
            'room_type_id' => $type->id,
            'floor' => 1,
            'status' => 'available',
            'cleaning_status' => 'clean',
            'capacity' => 2,
            'is_active' => true,
        ], $overrides));
    }

    protected function makeReservation(int $total = 440, ?Guest $owner = null): Reservation
    {
        $guest = $owner ?? $this->guest(['email' => 'res_guest@example.com']);
        $type = $this->roomType('suite', 200);
        $room = $this->room($type);

        $checkIn = now()->addDays(10)->format('Y-m-d');
        $checkOut = now()->addDays(12)->format('Y-m-d');

        return Reservation::create([
            'reservation_number' => 'BK-' . now()->year . '-' . random_int(1000, 9999),
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'status' => 'confirmed',
            'check_in' => $checkIn,
            'check_out' => $checkOut,
            'adults' => 2,
            'children' => 0,
            'price_per_night' => 200,
            'total_nights' => 2,
            'subtotal' => $total,
            'discount_percent' => 0,
            'discount_amount' => 0,
            'tax_percent' => 10,
            'tax_amount' => 0,
            'total_amount' => $total,
            'paid_amount' => 0,
            'due_amount' => $total,
            'payment_status' => 'unpaid',
            'source' => 'booking_engine',
        ]);
    }

    // =========================================================================
    // F1 — PAYMENT TOCTOU / ROW LOCKING
    // =========================================================================

    public function test_admin_payment_overpay_is_rejected(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);
        $reservation = $this->makeReservation(500);

        $this->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'amount' => 501,
            'payment_method' => 'cash',
            'payment_type' => 'partial',
        ])->assertStatus(422)
            ->assertJsonValidationErrors('amount');
    }

    public function test_admin_payment_exact_due_amount_succeeds_and_reconciles(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);
        $reservation = $this->makeReservation(500);

        $this->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'amount' => 500,
            'payment_method' => 'cash',
            'payment_type' => 'full',
        ])->assertStatus(201);

        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'paid_amount' => 500,
            'payment_status' => 'paid',
            'due_amount' => 0,
        ]);
    }

    public function test_guest_payment_overpay_is_rejected(): void
    {
        $guest = $this->guest();
        Sanctum::actingAs($guest);
        $reservation = $this->makeReservation(500, $guest);

        $this->postJson('/api/public/payments', [
            'reservation_id' => $reservation->id,
            'amount' => 501,
            'payment_method' => 'gcash',
            'payment_type' => 'partial',
        ])->assertStatus(404);
    }

    public function test_guest_cannot_pay_after_full_settlement(): void
    {
        $guest = $this->guest();
        Sanctum::actingAs($guest);
        $reservation = $this->makeReservation(500, $guest);

        $this->postJson('/api/public/payments', [
            'reservation_id' => $reservation->id,
            'amount' => 500,
            'payment_method' => 'gcash',
            'payment_type' => 'full',
        ])->assertStatus(404);

        $this->assertDatabaseCount('payments', 0);
    }

    public function test_admin_payment_status_update_reconciles_totals(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);
        $reservation = $this->makeReservation(500);

        $payment = Payment::create([
            'reservation_id' => $reservation->id,
            'guest_id' => $reservation->guest_id,
            'amount' => 500,
            'payment_method' => 'cash',
            'payment_type' => 'full',
            'status' => 'pending',
            'reference_number' => 'PAY-TEST-1',
            'paid_at' => now(),
        ]);

        $this->putJson("/api/payments/{$payment->id}", [
            'status' => 'completed',
        ])->assertStatus(200);

        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'paid_amount' => 500,
            'payment_status' => 'paid',
            'due_amount' => 0,
        ]);
    }

    // =========================================================================
    // F2 — RESERVATION NUMBER GENERATION
    // =========================================================================

    public function test_portal_reservation_number_has_unique_suffix(): void
    {
        $guest = $this->guest();
        Sanctum::actingAs($guest);
        $type = $this->roomType('deluxe', 150);
        $this->room($type);

        $response = $this->postJson('/api/public/reservations', [
            'room_type_id' => $type->id,
            'check_in' => now()->addDays(10)->format('Y-m-d'),
            'check_out' => now()->addDays(12)->format('Y-m-d'),
            'adults' => 2,
        ]);

        $response->assertStatus(201);
        $this->assertMatchesRegularExpression('/^BK-\d{4}-\d{4}-[A-Z0-9]{4}$/', $response->json('reservation_number'));
    }

    public function test_admin_reservation_number_has_unique_suffix(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);
        $type = $this->roomType('deluxe', 150);
        $room = $this->room($type);

        $response = $this->postJson('/api/reservations', [
            'guest_first_name' => 'Jane',
            'guest_last_name' => 'Doe',
            'guest_email' => 'jane@example.com',
            'guest_phone' => '09171234567',
            'room_id' => $room->id,
            'check_in' => now()->addDays(10)->format('Y-m-d'),
            'check_out' => now()->addDays(12)->format('Y-m-d'),
            'adults' => 2,
        ]);

        $response->assertStatus(201);
        $this->assertMatchesRegularExpression('/^BK-\d{4}-\d{4}-[A-Z0-9]{4}$/', $response->json('reservation_number'));
    }

    public function test_create_with_number_produces_distinct_numbers(): void
    {
        $guest = $this->guest(['email' => 'distinct@example.com']);
        $type = $this->roomType('deluxe', 150);
        $room = $this->room($type);

        $a = Reservation::createWithNumber([
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'status' => 'confirmed',
            'check_in' => now()->addDays(10)->format('Y-m-d'),
            'check_out' => now()->addDays(12)->format('Y-m-d'),
            'adults' => 2,
            'price_per_night' => 150,
            'total_nights' => 2,
            'subtotal' => 300,
            'total_amount' => 300,
            'due_amount' => 300,
        ]);
        $b = Reservation::createWithNumber([
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'status' => 'confirmed',
            'check_in' => now()->addDays(14)->format('Y-m-d'),
            'check_out' => now()->addDays(16)->format('Y-m-d'),
            'adults' => 2,
            'price_per_night' => 150,
            'total_nights' => 2,
            'subtotal' => 300,
            'total_amount' => 300,
            'due_amount' => 300,
        ]);

        $this->assertNotSame($a->reservation_number, $b->reservation_number);
        $this->assertMatchesRegularExpression('/^BK-\d{4}-\d{4}-[A-Z0-9]{4}$/', $a->reservation_number);
    }

    // =========================================================================
    // F4 — SETTINGS ALLOWLIST
    // =========================================================================

    public function test_settings_update_rejects_unknown_keys(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->putJson('/api/settings', [
            'settings' => [
                ['key' => 'arbitrary_injected_key', 'value' => 'pwned'],
            ],
        ])->assertStatus(422)
            ->assertJsonValidationErrors('settings.0.key');
    }

    public function test_settings_update_accepts_known_keys(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->putJson('/api/settings', [
            'settings' => [
                ['key' => 'hotel_name', 'value' => 'Pampanga Home Suites'],
            ],
        ])->assertStatus(200);

        $this->assertDatabaseHas('settings', [
            'key' => 'hotel_name',
            'value' => 'Pampanga Home Suites',
            'group' => 'hotel',
        ]);
    }

    // =========================================================================
    // F5 — PUBLIC SETTINGS GROUP WHITELIST
    // =========================================================================

    public function test_public_settings_allows_safe_groups(): void
    {
        Setting::create(['key' => 'hotel_name', 'value' => 'Pampanga Home Suites', 'group' => 'hotel']);

        $this->getJson('/api/public/settings/hotel')
            ->assertStatus(200)
            ->assertJsonPath('hotel_name', 'Pampanga Home Suites');
    }

    public function test_public_settings_rejects_sensitive_groups(): void
    {
        Setting::create(['key' => 'password_min_length', 'value' => '8', 'group' => 'security']);

        $this->getJson('/api/public/settings/security')->assertStatus(404);
        $this->getJson('/api/public/settings/general')->assertStatus(404);
    }
}
