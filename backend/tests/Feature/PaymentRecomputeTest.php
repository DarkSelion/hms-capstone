<?php

namespace Tests\Feature;

use App\Models\Guest;
use App\Models\Reservation;
use App\Models\Role;
use App\Models\Room;
use App\Models\RoomType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PaymentRecomputeTest extends TestCase
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

    protected function makeReservation(int $total = 275): Reservation
    {
        $guest = Guest::create([
            'first_name' => 'Jane',
            'last_name' => 'Doe',
            'email' => 'jane@example.com',
            'phone' => '09171234567',
            'password' => Hash::make('password'),
        ]);
        $type = RoomType::create([
            'name' => 'Deluxe',
            'slug' => 'deluxe',
            'base_price' => $total / 2,
        ]);
        $room = Room::create([
            'room_number' => '101',
            'room_type_id' => $type->id,
            'floor' => 1,
            'status' => 'available',
            'capacity' => 2,
        ]);

        return Reservation::create([
            'reservation_number' => 'BK-TEST-'.random_int(1000, 9999),
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'status' => 'confirmed',
            'check_in' => '2026-09-10',
            'check_out' => '2026-09-12',
            'adults' => 2,
            'price_per_night' => $total / 2,
            'total_nights' => 2,
            'subtotal' => $total,
            'total_amount' => $total,
            'due_amount' => $total,
        ]);
    }

    protected function recordPayment(array $overrides = []): \Illuminate\Testing\TestResponse
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);
        $reservation = $this->makeReservation(275);

        return $this->postJson('/api/payments', array_merge([
            'reservation_id' => $reservation->id,
            'amount' => 165,
            'payment_method' => 'cash',
            'payment_type' => 'partial',
        ], $overrides));
    }

    public function test_partial_cash_payment_recomputes_due_amount(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);
        $reservation = $this->makeReservation(275);

        $response = $this->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'amount' => 165,
            'payment_method' => 'cash',
            'payment_type' => 'partial',
        ]);
        $response->assertStatus(201);

        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'paid_amount' => 165,
            'payment_status' => 'partial',
            'due_amount' => 110,
        ]);
    }

    public function test_multiple_partial_payments_eventually_fully_pay(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);
        $reservation = $this->makeReservation(275);

        $this->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'amount' => 165,
            'payment_method' => 'cash',
            'payment_type' => 'partial',
        ])->assertStatus(201);

        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'paid_amount' => 165,
            'due_amount' => 110,
        ]);

        $this->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'amount' => 110,
            'payment_method' => 'cash',
            'payment_type' => 'partial',
        ])->assertStatus(201);

        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'paid_amount' => 275,
            'payment_status' => 'paid',
            'due_amount' => 0,
        ]);
    }

    public function test_pending_gcash_payment_does_not_reduce_due_amount(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);
        $reservation = $this->makeReservation(275);

        $this->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'amount' => 275,
            'payment_method' => 'gcash',
            'payment_type' => 'full',
            'status' => 'pending',
        ])->assertStatus(201);

        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'paid_amount' => 0,
            'payment_status' => 'unpaid',
            'due_amount' => 275,
        ]);
    }

    public function test_completing_a_pending_gcash_payment_then_reduces_due(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);
        $reservation = $this->makeReservation(275);

        $created = $this->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'amount' => 275,
            'payment_method' => 'gcash',
            'payment_type' => 'full',
            'status' => 'pending',
        ])->assertStatus(201);
        $paymentId = $created->json('id');

        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'due_amount' => 275,
        ]);

        $this->putJson("/api/payments/{$paymentId}", ['status' => 'completed'])->assertStatus(200);

        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'paid_amount' => 275,
            'payment_status' => 'paid',
            'due_amount' => 0,
        ]);
    }

    public function test_zero_amount_payment_rejected(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);
        $reservation = $this->makeReservation(275);

        $this->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'amount' => 0,
            'payment_method' => 'cash',
            'payment_type' => 'partial',
        ])->assertStatus(422)->assertJsonValidationErrors('amount');

        $this->assertDatabaseCount('payments', 0);
    }

    public function test_overpay_rejected(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);
        $reservation = $this->makeReservation(275);

        $this->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'amount' => 500,
            'payment_method' => 'cash',
            'payment_type' => 'full',
        ])->assertStatus(422)->assertJsonValidationErrors('amount');

        $this->assertDatabaseCount('payments', 0);
        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'paid_amount' => 0,
            'due_amount' => 275,
        ]);
    }

    public function test_uncompleting_a_completed_payment_reverts_totals(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);
        $reservation = $this->makeReservation(275);

        $created = $this->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'amount' => 165,
            'payment_method' => 'cash',
            'payment_type' => 'partial',
        ])->assertStatus(201);
        $paymentId = $created->json('id');

        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'paid_amount' => 165,
            'due_amount' => 110,
        ]);

        $this->putJson("/api/payments/{$paymentId}", ['status' => 'pending'])->assertStatus(200);

        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'paid_amount' => 0,
            'payment_status' => 'unpaid',
            'due_amount' => 275,
        ]);
    }

    public function test_refunding_a_completed_payment_reverts_totals(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);
        $reservation = $this->makeReservation(275);

        $created = $this->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'amount' => 275,
            'payment_method' => 'cash',
            'payment_type' => 'full',
        ])->assertStatus(201);
        $paymentId = $created->json('id');

        $this->putJson("/api/payments/{$paymentId}", ['status' => 'refunded'])->assertStatus(200);

        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'paid_amount' => 0,
            'payment_status' => 'unpaid',
            'due_amount' => 275,
        ]);
    }

    public function test_method_only_update_does_not_recompute(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);
        $reservation = $this->makeReservation(275);

        $created = $this->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'amount' => 165,
            'payment_method' => 'cash',
            'payment_type' => 'partial',
        ])->assertStatus(201);
        $paymentId = $created->json('id');

        $this->putJson("/api/payments/{$paymentId}", ['payment_method' => 'gcash'])->assertStatus(200);

        $this->assertDatabaseHas('payments', [
            'id' => $paymentId,
            'payment_method' => 'gcash',
        ]);
        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'paid_amount' => 165,
            'due_amount' => 110,
        ]);
    }

    public function test_store_creates_activity_log(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);
        $reservation = $this->makeReservation(275);

        $this->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'amount' => 165,
            'payment_method' => 'cash',
            'payment_type' => 'partial',
        ])->assertStatus(201);

        $this->assertDatabaseHas('activity_logs', [
            'user_id' => $admin->id,
            'module' => 'payments',
            'model_type' => 'Payment',
        ]);
    }

    public function test_destroy_returns_422(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);
        $reservation = $this->makeReservation(275);

        $created = $this->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'amount' => 165,
            'payment_method' => 'cash',
            'payment_type' => 'partial',
        ])->assertStatus(201);
        $paymentId = $created->json('id');

        $this->deleteJson("/api/payments/{$paymentId}")->assertStatus(422);

        $this->assertDatabaseHas('payments', ['id' => $paymentId]);
    }

    public function test_index_filters_by_method_status_and_date_range(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);
        $reservation = $this->makeReservation(275);

        $this->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'amount' => 165,
            'payment_method' => 'cash',
            'payment_type' => 'partial',
        ])->assertStatus(201);
        $this->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'amount' => 110,
            'payment_method' => 'gcash',
            'payment_type' => 'partial',
            'status' => 'pending',
        ])->assertStatus(201);

        $this->getJson('/api/payments?payment_method=cash&status=completed')->assertJsonCount(1, 'data');
        $this->getJson('/api/payments?payment_method=gcash')->assertJsonCount(1, 'data');
        $this->getJson('/api/payments?status=pending')->assertJsonCount(1, 'data');
        $this->getJson('/api/payments?date_from=' . now()->toDateString() . '&date_to=' . now()->toDateString())
            ->assertJsonCount(2, 'data');
    }

    public function test_index_search_by_reference_number(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);
        $reservation = $this->makeReservation(275);

        $this->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'amount' => 165,
            'payment_method' => 'cash',
            'payment_type' => 'partial',
            'reference_number' => 'RCV-7777',
        ])->assertStatus(201);
        $this->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'amount' => 110,
            'payment_method' => 'gcash',
            'payment_type' => 'partial',
        ])->assertStatus(201);

        $this->getJson('/api/payments?search=RCV-7777')->assertJsonCount(1, 'data');
    }

    public function test_index_sort_by_paid_at_allowed(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);
        $reservation = $this->makeReservation(275);

        $this->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'amount' => 165,
            'payment_method' => 'cash',
            'payment_type' => 'partial',
        ])->assertStatus(201);

        $this->getJson('/api/payments?sort=-paid_at')->assertStatus(200)->assertJsonCount(1, 'data');
    }

    public function test_index_invalid_sort_falls_back_to_created_at(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);
        $reservation = $this->makeReservation(275);

        $this->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'amount' => 165,
            'payment_method' => 'cash',
            'payment_type' => 'partial',
        ])->assertStatus(201);

        $this->getJson('/api/payments?sort=no_such_field')->assertStatus(200)->assertJsonCount(1, 'data');
    }
}
