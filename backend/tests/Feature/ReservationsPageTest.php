<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Guest;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\Room;
use App\Models\RoomType;
use App\Models\User;
use App\Models\Role;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ReservationsPageTest extends TestCase
{
    use RefreshDatabase;

    protected static int $roomCounter = 0;
    protected static int $guestCounter = 0;

    protected function admin(): User
    {
        $role = Role::create(['name' => 'Administrator', 'slug' => 'admin']);

        return User::create([
            'name' => 'Admin User',
            'email' => 'admin@test.com',
            'password' => Hash::make('password'),
            'role_id' => $role->id,
            'is_active' => true,
        ]);
    }

    protected function staff(): User
    {
        $role = Role::create(['name' => 'Receptionist', 'slug' => 'receptionist']);

        return User::create([
            'name' => 'Staff User',
            'email' => 'staff@test.com',
            'password' => Hash::make('password'),
            'role_id' => $role->id,
            'is_active' => true,
        ]);
    }

    protected function room(?string $status = 'available', ?int $typeId = null): Room
    {
        if ($typeId) {
            $type = RoomType::find($typeId);
        } else {
            $slug = 'room-type-' . (++self::$roomCounter);
            $type = RoomType::create([
                'name' => 'Standard',
                'slug' => $slug,
                'base_price' => 1000,
            ]);
        }

        return Room::create([
            'room_number' => '10' . self::$roomCounter,
            'room_type_id' => $type->id,
            'floor' => 1,
            'status' => $status,
            'capacity' => 2,
            'is_active' => true,
        ]);
    }

    protected function guest(): Guest
    {
        self::$guestCounter++;
        return Guest::create([
            'first_name' => 'Guest' . self::$guestCounter,
            'last_name' => 'Doe',
            'email' => 'guest' . self::$guestCounter . '@example.com',
            'phone' => '0917123456' . self::$guestCounter,
            'password' => Hash::make('password'),
        ]);
    }

    protected function reservation(array $overrides = []): Reservation
    {
        $guest = $this->guest();
        $room = $this->room('available');
        $id = Reservation::max('id') ?? 0;

        return Reservation::create(array_merge([
            'reservation_number' => 'BK-TEST-' . ($id + 1),
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'status' => 'confirmed',
            'check_in' => '2026-09-10',
            'check_out' => '2026-09-12',
            'adults' => 2,
            'children' => 0,
            'price_per_night' => 1000,
            'total_nights' => 2,
            'subtotal' => 2000,
            'total_amount' => 2200,
            'due_amount' => 2200,
            'paid_amount' => 0,
            'discount_percent' => 0,
            'discount_amount' => 0,
            'tax_percent' => 10,
            'tax_amount' => 200,
            'payment_status' => 'unpaid',
            'source' => 'direct',
        ], $overrides));
    }

    protected function recordPayment(Reservation $reservation, array $overrides = []): Payment
    {
        $payment = Payment::create(array_merge([
            'reservation_id' => $reservation->id,
            'guest_id' => $reservation->guest_id,
            'amount' => $reservation->due_amount,
            'payment_method' => 'cash',
            'payment_type' => 'full',
            'status' => 'completed',
        ], $overrides));

        $paidAmount = $reservation->payments()
            ->where('status', 'completed')
            ->sum('amount');

        $reservation->update([
            'paid_amount' => $paidAmount,
            'payment_status' => $paidAmount <= 0
                ? 'unpaid'
                : ($paidAmount >= $reservation->total_amount ? 'paid' : 'partial'),
            'due_amount' => max(0, $reservation->total_amount - $paidAmount),
        ]);

        return $payment;
    }

    // ─── Listing / Index ─────────────────────────────────────

    public function test_index_returns_paginated_reservations_with_relations(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->reservation();

        $response = $this->getJson('/api/reservations');
        $response->assertStatus(200);

        $data = $response->json();
        $this->assertArrayHasKey('data', $data);
        $this->assertCount(1, $data['data']);
        $this->assertArrayHasKey('guest', $data['data'][0]);
        $this->assertArrayHasKey('room', $data['data'][0]);
        $this->assertArrayHasKey('room_type', $data['data'][0]['room']);
    }

    public function test_index_search_by_reservation_number(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->reservation(['reservation_number' => 'BK-SEARCH-123']);
        $this->reservation(['reservation_number' => 'BK-OTHER-456']);

        $response = $this->getJson('/api/reservations?search=BK-SEARCH');
        $response->assertStatus(200);

        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertEquals('BK-SEARCH-123', $data[0]['reservation_number']);
    }

    public function test_index_search_by_guest_name(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->reservation();

        // Create a specific guest and reservation for search
        $guest = $this->guest();
        $room = $this->room('available');
        Reservation::create([
            'reservation_number' => 'BK-JOHN-001',
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'status' => 'confirmed',
            'check_in' => '2026-09-10',
            'check_out' => '2026-09-12',
            'adults' => 1,
            'price_per_night' => 1000,
            'total_nights' => 2,
            'subtotal' => 2000,
            'total_amount' => 2200,
            'due_amount' => 2200,
            'payment_status' => 'unpaid',
        ]);

        $response = $this->getJson('/api/reservations?search=Guest');
        $response->assertStatus(200);

        $data = $response->json('data');
        $this->assertCount(2, $data);
    }

    public function test_index_filter_by_status(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->reservation(['status' => 'confirmed']);
        $this->reservation(['status' => 'pending']);

        $response = $this->getJson('/api/reservations?status=confirmed');
        $response->assertStatus(200);

        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertEquals('confirmed', $data[0]['status']);
    }

    public function test_index_filter_by_multiple_statuses(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->reservation(['status' => 'confirmed']);
        $this->reservation(['status' => 'pending']);
        $this->reservation(['status' => 'cancelled']);

        $response = $this->getJson('/api/reservations?status=pending,confirmed');
        $response->assertStatus(200);

        $data = $response->json('data');
        $this->assertCount(2, $data);
    }

    public function test_index_sorting(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->reservation(['reservation_number' => 'BK-001']);
        $this->reservation(['reservation_number' => 'BK-002']);

        $response = $this->getJson('/api/reservations?sort=reservation_number&sort_dir=desc');
        $response->assertStatus(200);

        $data = $response->json('data');
        $this->assertEquals('BK-002', $data[0]['reservation_number']);
        $this->assertEquals('BK-001', $data[1]['reservation_number']);
    }

    public function test_index_requires_authentication(): void
    {
        $this->getJson('/api/reservations')->assertStatus(401);
    }

    // ─── Create (New Reservation Wizard) ─────────────────────

    public function test_create_reservation_with_valid_data(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $room = $this->room('available');

        $response = $this->postJson('/api/reservations', [
            'guest_first_name' => 'Juan',
            'guest_last_name' => 'Dela Cruz',
            'guest_email' => 'juan@example.com',
            'guest_phone' => '09171234567',
            'room_id' => $room->id,
            'check_in' => '2026-09-10',
            'check_out' => '2026-09-12',
            'adults' => 2,
            'children' => 1,
            'price_per_night' => 1000,
        ]);

        $response->assertStatus(201);

        $reservation = $response->json();
        $this->assertEquals('confirmed', $reservation['status']);
        $this->assertDatabaseHas('rooms', ['id' => $room->id, 'status' => 'reserved']);

        // Activity log created
        $this->assertDatabaseHas('activity_logs', [
            'action' => 'created',
            'module' => 'reservations',
        ]);
    }

    public function test_create_reservation_autocreates_guest(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $room = $this->room('available');

        $response = $this->postJson('/api/reservations', [
            'guest_first_name' => 'New',
            'guest_last_name' => 'Guest',
            'guest_email' => 'newguest@example.com',
            'guest_phone' => '09171234567',
            'room_id' => $room->id,
            'check_in' => '2026-09-10',
            'check_out' => '2026-09-12',
            'adults' => 1,
            'price_per_night' => 1000,
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('guests', [
            'first_name' => 'New',
            'last_name' => 'Guest',
            'email' => 'newguest@example.com',
        ]);
    }

    public function test_create_reservation_reuses_existing_guest(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $room = $this->room('available');
        $existing = Guest::create([
            'first_name' => 'Existing',
            'last_name' => 'Customer',
            'email' => 'existing@example.com',
            'phone' => '0999',
            'password' => Hash::make('password'),
        ]);

        $response = $this->postJson('/api/reservations', [
            'guest_first_name' => 'Different Name',
            'guest_last_name' => 'Override',
            'guest_email' => 'existing@example.com',
            'guest_phone' => '09171234567',
            'room_id' => $room->id,
            'check_in' => '2026-09-10',
            'check_out' => '2026-09-12',
            'adults' => 1,
            'price_per_night' => 1000,
        ]);

        $response->assertStatus(201);
        // Should not create a duplicate guest
        $this->assertEquals(1, Guest::where('email', 'existing@example.com')->count());
    }

    public function test_create_reservation_validates_required_fields(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/reservations', [
            'guest_phone' => '0917',
            // Missing required fields
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['guest_first_name', 'guest_last_name', 'room_id', 'check_in', 'check_out', 'adults']);
    }

    public function test_create_reservation_validates_check_out_after_check_in(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $room = $this->room('available');

        $response = $this->postJson('/api/reservations', [
            'guest_first_name' => 'Juan',
            'guest_last_name' => 'Dela Cruz',
            'guest_phone' => '09171234567',
            'room_id' => $room->id,
            'check_in' => '2026-09-12',
            'check_out' => '2026-09-10',
            'adults' => 1,
            'price_per_night' => 1000,
        ]);

        $response->assertStatus(422);
    }

    public function test_create_reservation_rejects_overlapping_dates(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $room = $this->room('reserved');
        $guest = $this->guest();

        Reservation::create([
            'reservation_number' => 'BK-OVERLAP-1',
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'status' => 'confirmed',
            'check_in' => '2026-09-10',
            'check_out' => '2026-09-15',
            'adults' => 1,
            'price_per_night' => 1000,
            'total_nights' => 5,
            'subtotal' => 5000,
            'total_amount' => 5600,
            'due_amount' => 5600,
            'paid_amount' => 0,
            'discount_percent' => 0,
            'discount_amount' => 0,
            'tax_percent' => 10,
            'tax_amount' => 600,
            'payment_status' => 'unpaid',
        ]);

        $response = $this->postJson('/api/reservations', [
            'guest_first_name' => 'Bob',
            'guest_last_name' => 'Smith',
            'guest_email' => 'bob@example.com',
            'guest_phone' => '0918',
            'room_id' => $room->id,
            'check_in' => '2026-09-12',
            'check_out' => '2026-09-14',
            'adults' => 1,
            'price_per_night' => 1000,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['room_id']);
    }

    // ─── Show (Detail Modal) ─────────────────────────────────

    public function test_show_returns_reservation_with_full_relations(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation();

        $response = $this->getJson("/api/reservations/{$reservation->id}");
        $response->assertStatus(200);

        $data = $response->json();
        $this->assertArrayHasKey('guest', $data);
        $this->assertArrayHasKey('room', $data);
        $this->assertArrayHasKey('payments', $data);
        $this->assertArrayHasKey('invoices', $data);
    }

    // ─── Update (Edit Reservation) ───────────────────────────

    public function test_update_reservation_status(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation(['status' => 'confirmed']);

        $response = $this->putJson("/api/reservations/{$reservation->id}", [
            'status' => 'cancelled',
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => 'cancelled',
        ]);
    }

    public function test_update_reservation_recalculates_total_when_dates_change(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation([
            'check_in' => '2026-09-10',
            'check_out' => '2026-09-12',
            'price_per_night' => 1000,
            'total_amount' => 2200,
            'tax_percent' => 10,
            'tax_amount' => 200,
            'subtotal' => 2000,
        ]);

        $response = $this->putJson("/api/reservations/{$reservation->id}", [
            'check_out' => '2026-09-13',
        ]);

        $response->assertStatus(200);
        $updated = $response->json();
        // 3 nights * 1000 = 3000 + 10% tax = 3300
        $this->assertEquals(3300, (float) $updated['total_amount']);
    }

    public function test_update_reservation_validates_check_out_after_check_in(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation([
            'check_in' => '2026-09-10',
            'check_out' => '2026-09-12',
        ]);

        $response = $this->putJson("/api/reservations/{$reservation->id}", [
            'check_out' => '2026-09-08',
        ]);

        $response->assertStatus(422);
    }

    public function test_update_reservation_allows_staff_role(): void
    {
        $staff = $this->staff();
        Sanctum::actingAs($staff);

        $reservation = $this->reservation();

        $response = $this->getJson("/api/reservations/{$reservation->id}");
        $response->assertStatus(200);
    }

    // ─── Check-in ─────────────────────────────────────────────

    public function test_check_in_from_confirmed(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation(['status' => 'confirmed']);
        $reservation->room->update(['status' => 'reserved']);
        $this->recordPayment($reservation);

        $response = $this->postJson("/api/reservations/{$reservation->id}/check-in");
        $response->assertStatus(200);

        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => 'checked_in',
        ]);
        $this->assertDatabaseHas('rooms', [
            'id' => $reservation->room_id,
            'status' => 'occupied',
        ]);

        $this->assertDatabaseHas('activity_logs', [
            'action' => 'checked_in',
            'module' => 'reservations',
        ]);
    }

    public function test_check_in_from_pending_allowed(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation(['status' => 'pending']);
        $this->recordPayment($reservation);

        $response = $this->postJson("/api/reservations/{$reservation->id}/check-in");
        $response->assertStatus(200);
        $this->assertEquals('checked_in', $reservation->fresh()->status);
    }

    public function test_check_in_rejected_from_checked_in(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation(['status' => 'checked_in']);

        $response = $this->postJson("/api/reservations/{$reservation->id}/check-in");
        $response->assertStatus(422);
    }

    public function test_check_in_rejected_from_checked_out(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation(['status' => 'checked_out']);

        $response = $this->postJson("/api/reservations/{$reservation->id}/check-in");
        $response->assertStatus(422);
    }

    public function test_check_in_rejected_from_cancelled(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation(['status' => 'cancelled']);

        $response = $this->postJson("/api/reservations/{$reservation->id}/check-in");
        $response->assertStatus(422);
    }

    public function test_check_in_rejected_from_no_show(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation(['status' => 'no_show']);

        $response = $this->postJson("/api/reservations/{$reservation->id}/check-in");
        $response->assertStatus(422);
    }

    // ─── Check-out ────────────────────────────────────────────

    public function test_check_out_from_checked_in(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation(['status' => 'checked_in']);
        $reservation->room->update(['status' => 'occupied']);
        $this->recordPayment($reservation);

        $response = $this->postJson("/api/reservations/{$reservation->id}/check-out");
        $response->assertStatus(200);

        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => 'checked_out',
        ]);
        $this->assertDatabaseHas('rooms', [
            'id' => $reservation->room_id,
            'status' => 'dirty',
            'cleaning_status' => 'dirty',
        ]);

        $this->assertDatabaseHas('activity_logs', [
            'action' => 'checked_out',
            'module' => 'reservations',
        ]);
    }

    public function test_check_out_rejected_from_confirmed(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation(['status' => 'confirmed']);

        $response = $this->postJson("/api/reservations/{$reservation->id}/check-out");
        $response->assertStatus(422);
    }

    public function test_check_out_rejected_from_pending(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation(['status' => 'pending']);

        $response = $this->postJson("/api/reservations/{$reservation->id}/check-out");
        $response->assertStatus(422);
    }

    // ─── Payment required before check-in / check-out ─────────

    public function test_check_in_rejected_when_balance_unpaid_and_no_payment(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation(['status' => 'confirmed']);

        $response = $this->postJson("/api/reservations/{$reservation->id}/check-in");
        $response->assertStatus(422);
        $response->assertJsonPath('message', 'Collect a payment before checking in.');
        $this->assertEquals('confirmed', $reservation->fresh()->status);
    }

    public function test_check_in_allowed_when_pending_gcash_payment_recorded(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation(['status' => 'confirmed']);
        $this->recordPayment($reservation, ['payment_method' => 'gcash', 'status' => 'pending']);

        $response = $this->postJson("/api/reservations/{$reservation->id}/check-in");
        $response->assertStatus(200);
        $this->assertEquals('checked_in', $reservation->fresh()->status);
    }

    public function test_check_in_allowed_when_partial_payment_recorded(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation(['status' => 'confirmed']);
        $this->recordPayment($reservation, ['amount' => 1000, 'payment_type' => 'partial']);

        $response = $this->postJson("/api/reservations/{$reservation->id}/check-in");
        $response->assertStatus(200);
        $this->assertEquals('checked_in', $reservation->fresh()->status);
    }

    public function test_check_in_rejected_when_only_failed_payment_recorded(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation(['status' => 'confirmed']);
        $this->recordPayment($reservation, ['status' => 'failed']);

        $response = $this->postJson("/api/reservations/{$reservation->id}/check-in");
        $response->assertStatus(422);
        $response->assertJsonPath('message', 'Collect a payment before checking in.');
        $this->assertEquals('confirmed', $reservation->fresh()->status);
    }

    public function test_check_in_rejected_when_only_refunded_payment_recorded(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation(['status' => 'confirmed']);
        $this->recordPayment($reservation, ['status' => 'refunded']);

        $response = $this->postJson("/api/reservations/{$reservation->id}/check-in");
        $response->assertStatus(422);
        $response->assertJsonPath('message', 'Collect a payment before checking in.');
        $this->assertEquals('confirmed', $reservation->fresh()->status);
    }

    public function test_check_out_rejected_when_balance_unpaid_and_no_payment(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation(['status' => 'checked_in']);

        $response = $this->postJson("/api/reservations/{$reservation->id}/check-out");
        $response->assertStatus(422);
        $response->assertJsonPath('message', 'Settle the outstanding balance before checking out.');
        $this->assertEquals('checked_in', $reservation->fresh()->status);
    }

    public function test_check_out_rejected_when_pending_gcash_payment_recorded(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation(['status' => 'checked_in']);
        $this->recordPayment($reservation, ['payment_method' => 'gcash', 'status' => 'pending']);

        $response = $this->postJson("/api/reservations/{$reservation->id}/check-out");
        $response->assertStatus(422);
        $response->assertJsonPath('message', 'Settle the outstanding balance before checking out.');
        $this->assertEquals('checked_in', $reservation->fresh()->status);
    }

    public function test_check_out_rejected_when_partial_payment_recorded(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation(['status' => 'checked_in']);
        $this->recordPayment($reservation, ['amount' => 1000, 'payment_type' => 'partial']);

        $response = $this->postJson("/api/reservations/{$reservation->id}/check-out");
        $response->assertStatus(422);
        $response->assertJsonPath('message', 'Settle the outstanding balance before checking out.');
        $this->assertEquals('checked_in', $reservation->fresh()->status);
    }

    // ─── Cancel ───────────────────────────────────────────────

    public function test_cancel_from_pending(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation(['status' => 'pending']);
        $reservation->room->update(['status' => 'reserved']);

        $response = $this->postJson("/api/reservations/{$reservation->id}/cancel");
        $response->assertStatus(200);

        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => 'cancelled',
        ]);
        $this->assertDatabaseHas('rooms', [
            'id' => $reservation->room_id,
            'status' => 'available',
        ]);

        $this->assertDatabaseHas('activity_logs', [
            'action' => 'cancelled',
            'module' => 'reservations',
        ]);
    }

    public function test_cancel_from_confirmed(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation(['status' => 'confirmed']);

        $response = $this->postJson("/api/reservations/{$reservation->id}/cancel");
        $response->assertStatus(200);

        $this->assertEquals('cancelled', $reservation->fresh()->status);
    }

    public function test_cancel_rejected_from_checked_in(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation(['status' => 'checked_in']);

        $response = $this->postJson("/api/reservations/{$reservation->id}/cancel");
        $response->assertStatus(422);
    }

    public function test_cancel_rejected_from_checked_out(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation(['status' => 'checked_out']);

        $response = $this->postJson("/api/reservations/{$reservation->id}/cancel");
        $response->assertStatus(422);
    }

    public function test_cancel_rejected_from_already_cancelled(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation(['status' => 'cancelled']);

        $response = $this->postJson("/api/reservations/{$reservation->id}/cancel");
        $response->assertStatus(422);
    }

    // ─── Destroy ──────────────────────────────────────────────

    public function test_destroy_reservation_allowed_when_not_checked_in_or_out(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation(['status' => 'confirmed']);
        $reservation->room->update(['status' => 'reserved']);

        $response = $this->deleteJson("/api/reservations/{$reservation->id}");
        $response->assertStatus(200);

        $this->assertDatabaseMissing('reservations', ['id' => $reservation->id]);
        $this->assertDatabaseHas('rooms', [
            'id' => $reservation->room_id,
            'status' => 'available',
        ]);
    }

    public function test_destroy_rejected_for_checked_in(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation(['status' => 'checked_in']);

        $response = $this->deleteJson("/api/reservations/{$reservation->id}");
        $response->assertStatus(422);
    }

    public function test_destroy_rejected_for_checked_out(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation(['status' => 'checked_out']);

        $response = $this->deleteJson("/api/reservations/{$reservation->id}");
        $response->assertStatus(422);
    }

    public function test_create_reservation_with_pending_status(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $room = $this->room('available');

        $response = $this->postJson('/api/reservations', [
            'guest_first_name' => 'Juan',
            'guest_last_name' => 'Dela Cruz',
            'guest_phone' => '09171234567',
            'room_id' => $room->id,
            'check_in' => '2026-09-10',
            'check_out' => '2026-09-12',
            'adults' => 2,
            'price_per_night' => 1000,
            'status' => 'pending',
        ]);

        $response->assertStatus(201);
        $this->assertEquals('pending', $response->json('status'));
        $this->assertDatabaseHas('rooms', ['id' => $room->id, 'status' => 'reserved']);
    }

    public function test_create_reservation_rejects_invalid_status(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $room = $this->room('available');

        $response = $this->postJson('/api/reservations', [
            'guest_first_name' => 'Juan',
            'guest_last_name' => 'Dela Cruz',
            'guest_phone' => '09171234567',
            'room_id' => $room->id,
            'check_in' => '2026-09-10',
            'check_out' => '2026-09-12',
            'adults' => 2,
            'price_per_night' => 1000,
            'status' => 'cancelled',
        ]);

        $response->assertStatus(422);
    }

    public function test_completed_payment_flips_pending_reservation_to_confirmed(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation(['status' => 'pending']);

        $response = $this->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'amount' => 1100,
            'payment_method' => 'cash',
            'payment_type' => 'partial',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => 'confirmed',
        ]);
    }

    public function test_pending_payment_does_not_flip_pending_reservation(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation(['status' => 'pending']);

        $response = $this->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'amount' => 1100,
            'payment_method' => 'gcash',
            'payment_type' => 'partial',
            'status' => 'pending',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => 'pending',
        ]);
    }

    public function test_updating_payment_to_completed_flips_pending_reservation_to_confirmed(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation(['status' => 'pending']);
        $payment = $this->recordPayment($reservation, [
            'status' => 'pending',
            'payment_method' => 'gcash',
        ]);

        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => 'pending',
        ]);

        $response = $this->putJson("/api/payments/{$payment->id}", [
            'status' => 'completed',
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => 'confirmed',
        ]);
    }

    // ─── Status transition enforcement (C1) ─────────────────

    public function test_update_rejects_invalid_transition_cancelled_to_checked_in(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation(['status' => 'cancelled']);

        $response = $this->putJson("/api/reservations/{$reservation->id}", [
            'status' => 'checked_in',
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('message', 'Cannot change status from cancelled to checked_in.');
        $this->assertEquals('cancelled', $reservation->fresh()->status);
    }

    public function test_update_rejects_invalid_transition_confirmed_to_checked_out(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation(['status' => 'confirmed']);

        $response = $this->putJson("/api/reservations/{$reservation->id}", [
            'status' => 'checked_out',
        ]);

        $response->assertStatus(422);
        $this->assertEquals('confirmed', $reservation->fresh()->status);
    }

    public function test_update_rejects_invalid_transition_pending_to_no_show(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation(['status' => 'pending']);

        $response = $this->putJson("/api/reservations/{$reservation->id}", [
            'status' => 'no_show',
        ]);

        $response->assertStatus(422);
        $this->assertEquals('pending', $reservation->fresh()->status);
    }

    public function test_update_check_in_requires_payment(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation(['status' => 'confirmed']);

        $response = $this->putJson("/api/reservations/{$reservation->id}", [
            'status' => 'checked_in',
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('message', 'Collect a payment before checking in.');
        $this->assertEquals('confirmed', $reservation->fresh()->status);
    }

    public function test_update_check_in_allowed_when_payment_recorded(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation(['status' => 'confirmed']);
        $reservation->room->update(['status' => 'reserved']);
        $this->recordPayment($reservation);

        $response = $this->putJson("/api/reservations/{$reservation->id}", [
            'status' => 'checked_in',
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => 'checked_in',
            'checked_in_by' => $admin->id,
        ]);
        $this->assertDatabaseHas('rooms', [
            'id' => $reservation->room_id,
            'status' => 'occupied',
        ]);
    }

    public function test_update_check_out_requires_full_settlement(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation(['status' => 'checked_in']);
        $reservation->room->update(['status' => 'occupied']);

        $response = $this->putJson("/api/reservations/{$reservation->id}", [
            'status' => 'checked_out',
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('message', 'Settle the outstanding balance before checking out.');
        $this->assertEquals('checked_in', $reservation->fresh()->status);
    }

    public function test_update_check_out_allowed_when_settled(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation(['status' => 'checked_in']);
        $reservation->room->update(['status' => 'occupied']);
        $this->recordPayment($reservation);

        $response = $this->putJson("/api/reservations/{$reservation->id}", [
            'status' => 'checked_out',
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => 'checked_out',
            'checked_out_by' => $admin->id,
        ]);
        $this->assertDatabaseHas('rooms', [
            'id' => $reservation->room_id,
            'status' => 'dirty',
        ]);
    }

    // ─── Server-side pricing (C2) ─────────────────────────────

    public function test_create_reservation_ignores_client_total_amount(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $room = $this->room('available');

        $response = $this->postJson('/api/reservations', [
            'guest_first_name' => 'Juan',
            'guest_last_name' => 'Dela Cruz',
            'guest_phone' => '09171234567',
            'room_id' => $room->id,
            'check_in' => '2026-09-10',
            'check_out' => '2026-09-12',
            'adults' => 2,
            'price_per_night' => 1000,
            'total_amount' => 1,
        ]);

        $response->assertStatus(201);
        // 2 nights * 1000 = 2000 + 10% tax = 2200 (client's "1" must be ignored)
        $this->assertEquals(2200, (float) $response->json('total_amount'));
        $this->assertEquals(2200, (float) $response->json('due_amount'));
    }

    public function test_create_reservation_rate_derived_from_room_override(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $room = $this->room('available');
        $room->update(['price_override' => 2500]);

        $response = $this->postJson('/api/reservations', [
            'guest_first_name' => 'Juan',
            'guest_last_name' => 'Dela Cruz',
            'guest_phone' => '09171234567',
            'room_id' => $room->id,
            'check_in' => '2026-09-10',
            'check_out' => '2026-09-12',
            'adults' => 2,
            'price_per_night' => 1000,
        ]);

        $response->assertStatus(201);
        // 2 nights * 2500 = 5000 + 10% tax = 5500 (client price must be ignored)
        $this->assertEquals(5500, (float) $response->json('total_amount'));
        $this->assertEquals(2500, (float) $response->json('price_per_night'));
    }

    public function test_update_honors_client_price_and_ignores_client_total(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation([
            'check_in' => '2026-09-10',
            'check_out' => '2026-09-12',
            'price_per_night' => 1000,
            'total_amount' => 2200,
        ]);

        $response = $this->putJson("/api/reservations/{$reservation->id}", [
            'price_per_night' => 1,
            'total_amount' => 1,
        ]);

        $response->assertStatus(200);
        // Client price is honored; the client total is discarded and recomputed
        // from the rate (1 * 2 nights + 10% tax = 2.2).
        $this->assertEquals(1, (float) $response->json('price_per_night'));
        $this->assertEquals(2.2, (float) $response->json('total_amount'));
    }

    public function test_update_room_change_recalculates_from_new_room_rate(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation([
            'check_in' => '2026-09-10',
            'check_out' => '2026-09-12',
            'price_per_night' => 1000,
            'total_amount' => 2200,
            'subtotal' => 2000,
        ]);
        $oldRoom = $reservation->room;
        $oldRoom->update(['status' => 'reserved']);

        $newRoom = $this->room('available');
        $newRoom->update(['price_override' => 1500]);

        $response = $this->putJson("/api/reservations/{$reservation->id}", [
            'room_id' => $newRoom->id,
        ]);

        $response->assertStatus(200);
        // 2 nights * 1500 = 3000 + 10% tax = 3300
        $this->assertEquals(1500, (float) $response->json('price_per_night'));
        $this->assertEquals(3300, (float) $response->json('total_amount'));
        // Old room reconciled (no other active reservations)
        $this->assertDatabaseHas('rooms', ['id' => $oldRoom->id, 'status' => 'available']);
    }

    public function test_update_clears_overdue_flag_when_check_in_moved_to_today(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation([
            'check_in' => now()->subDay()->toDateString(),
            'check_out' => now()->addDay()->toDateString(),
            'is_overdue' => true,
            'overdue_at' => now()->startOfDay(),
            'price_per_night' => 1000,
            'total_amount' => 2200,
        ]);

        $response = $this->putJson("/api/reservations/{$reservation->id}", [
            'check_in' => now()->toDateString(),
            'check_out' => now()->addDay()->toDateString(),
        ]);

        $response->assertStatus(200);
        $this->assertFalse($response->json('is_overdue'));
        $this->assertNull($response->json('overdue_at'));
        $this->assertFalse($reservation->fresh()->is_overdue);
        $this->assertNull($reservation->fresh()->overdue_at);
    }

    public function test_update_keeps_overdue_flag_when_check_in_still_in_past(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation([
            'check_in' => now()->subDays(3)->toDateString(),
            'check_out' => now()->addDay()->toDateString(),
            'is_overdue' => true,
            'overdue_at' => now()->subDays(3)->startOfDay(),
            'price_per_night' => 1000,
            'total_amount' => 2200,
        ]);

        $response = $this->putJson("/api/reservations/{$reservation->id}", [
            'check_in' => now()->subDay()->toDateString(),
            'check_out' => now()->addDay()->toDateString(),
        ]);

        $response->assertStatus(200);
        $this->assertTrue($response->json('is_overdue'));
        $this->assertTrue($reservation->fresh()->is_overdue);
    }

    public function test_update_keeps_unpaid_status_when_no_payment_recorded(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation([
            'check_in' => '2026-09-10',
            'check_out' => '2026-09-12',
            'payment_status' => 'unpaid',
            'paid_amount' => 0,
            'due_amount' => 2200,
        ]);

        $response = $this->putJson("/api/reservations/{$reservation->id}", [
            'check_in' => '2026-09-12',
            'check_out' => '2026-09-13',
        ]);

        $response->assertStatus(200);
        // No payments recorded, so status must stay unpaid (not partial).
        $this->assertEquals('unpaid', $response->json('payment_status'));
        $this->assertEquals('unpaid', $reservation->fresh()->payment_status);
        $this->assertEquals(0, (float) $reservation->fresh()->paid_amount);
    }
}
