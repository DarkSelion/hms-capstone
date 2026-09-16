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

class ReservationIntegrityTest extends TestCase
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

    protected function guest(): Guest
    {
        return Guest::create([
            'first_name' => 'Jane',
            'last_name' => 'Doe',
            'email' => 'jane@example.com',
            'phone' => '09171234567',
            'password' => Hash::make('password'),
        ]);
    }

    protected function room(): Room
    {
        $type = RoomType::create([
            'name' => 'Deluxe',
            'slug' => 'deluxe',
            'base_price' => 1000,
        ]);

        return Room::create([
            'room_number' => '101',
            'room_type_id' => $type->id,
            'floor' => 1,
            'status' => 'available',
            'capacity' => 2,
        ]);
    }

    public function test_admin_cannot_double_book_room(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);
        $room = $this->room();

        $first = $this->postJson('/api/reservations', [
            'guest_first_name' => 'Jane',
            'guest_last_name' => 'Doe',
            'guest_email' => 'jane@gmail.com',
            'guest_phone' => '09171234567',
            'room_id' => $room->id,
            'check_in' => now()->addDays(3)->toDateString(),
            'check_out' => now()->addDays(5)->toDateString(),
            'adults' => 2,
            'price_per_night' => 1000,
        ]);
        $first->assertStatus(201);

        $second = $this->postJson('/api/reservations', [
            'guest_first_name' => 'Bob',
            'guest_last_name' => 'Smith',
            'guest_email' => 'bob@gmail.com',
            'guest_phone' => '09181234567',
            'room_id' => $room->id,
            'check_in' => now()->addDays(4)->toDateString(),
            'check_out' => now()->addDays(6)->toDateString(),
            'adults' => 1,
            'price_per_night' => 1000,
        ]);
        $second->assertStatus(422);
    }

    public function test_cancel_via_update_frees_room(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);
        $room = $this->room();
        $guest = $this->guest();

        $reservation = Reservation::create([
            'reservation_number' => 'BK-TEST-1001',
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'status' => 'confirmed',
            'check_in' => '2026-09-10',
            'check_out' => '2026-09-12',
            'adults' => 2,
            'price_per_night' => 1000,
            'total_nights' => 2,
            'subtotal' => 2000,
            'total_amount' => 2000,
            'due_amount' => 2000,
        ]);
        $room->update(['status' => 'reserved']);

        $this->putJson("/api/reservations/{$reservation->id}", [
            'status' => 'cancelled',
        ])->assertStatus(200);

        $this->assertDatabaseHas('rooms', [
            'id' => $room->id,
            'status' => 'available',
        ]);
    }

    public function test_admin_cannot_extend_dates_over_existing_booking(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);
        $room = $this->room();
        $guest = $this->guest();

        $first = Reservation::create([
            'reservation_number' => 'BK-TEST-1003',
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'status' => 'confirmed',
            'check_in' => '2026-09-10',
            'check_out' => '2026-09-12',
            'adults' => 2,
            'price_per_night' => 1000,
            'total_nights' => 2,
            'subtotal' => 2000,
            'total_amount' => 2000,
            'due_amount' => 2000,
        ]);
        $second = Reservation::create([
            'reservation_number' => 'BK-TEST-1004',
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'status' => 'confirmed',
            'check_in' => '2026-09-20',
            'check_out' => '2026-09-22',
            'adults' => 2,
            'price_per_night' => 1000,
            'total_nights' => 2,
            'subtotal' => 2000,
            'total_amount' => 2000,
            'due_amount' => 2000,
        ]);

        $this->putJson("/api/reservations/{$first->id}", [
            'check_out' => '2026-09-21',
        ])->assertStatus(422);

        $this->assertEquals('2026-09-12', $first->fresh()->check_out->toDateString());
    }

    public function test_cancel_endpoint_frees_room(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);
        $room = $this->room();
        $guest = $this->guest();

        $reservation = Reservation::create([
            'reservation_number' => 'BK-TEST-1002',
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'status' => 'confirmed',
            'check_in' => '2026-09-10',
            'check_out' => '2026-09-12',
            'adults' => 2,
            'price_per_night' => 1000,
            'total_nights' => 2,
            'subtotal' => 2000,
            'total_amount' => 2000,
            'due_amount' => 2000,
        ]);
        $room->update(['status' => 'reserved']);

        $this->postJson("/api/reservations/{$reservation->id}/cancel")
            ->assertStatus(200);

        $this->assertDatabaseHas('rooms', [
            'id' => $room->id,
            'status' => 'available',
        ]);
    }
}
