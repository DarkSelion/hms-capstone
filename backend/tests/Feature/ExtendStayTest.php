<?php

namespace Tests\Feature;

use App\Models\Guest;
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

class ExtendStayTest extends TestCase
{
    use RefreshDatabase;

    protected function admin(): User
    {
        $role = Role::create(['name' => 'Admin', 'slug' => 'admin']);

        return User::create([
            'name' => 'Admin User',
            'email' => 'admin@test.com',
            'password' => Hash::make('password'),
            'role_id' => $role->id,
            'is_active' => true,
        ]);
    }

    protected function guest(): Guest
    {
        return Guest::create([
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => uniqid('guest') . '@example.com',
            'phone' => '09171234567',
            'password' => Hash::make('password'),
        ]);
    }

    protected function room(): Room
    {
        $type = RoomType::create([
            'name' => 'Deluxe',
            'slug' => 'deluxe-' . uniqid(),
            'base_price' => 1000,
            'capacity' => 2,
            'max_adults' => 2,
            'max_children' => 1,
            'is_active' => true,
        ]);

        return Room::create([
            'room_number' => uniqid('R'),
            'room_type_id' => $type->id,
            'floor' => 1,
            'status' => 'occupied',
            'cleaning_status' => 'clean',
            'capacity' => 2,
            'is_active' => true,
        ]);
    }

    protected function setTaxRate(string $rate): void
    {
        Setting::create(['key' => 'tax_rate', 'value' => $rate, 'group' => 'tax']);
    }

    /**
     * Checked-in reservation booked today for 2 nights (rate 1000, tax 10%):
     * nights 2, subtotal 2000, tax 200, total 2200.
     */
    protected function reservation(Room $room, array $overrides = []): Reservation
    {
        $guest = $this->guest();
        $id = Reservation::max('id') ?? 0;

        return Reservation::create(array_merge([
            'reservation_number' => 'BK-EXT-' . ($id + 1),
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'status' => 'checked_in',
            'check_in' => now()->format('Y-m-d'),
            'check_out' => now()->addDays(2)->format('Y-m-d'),
            'adults' => 2,
            'children' => 0,
            'price_per_night' => 1000,
            'total_nights' => 2,
            'subtotal' => 2000,
            'discount_percent' => 0,
            'discount_amount' => 0,
            'tax_percent' => 10,
            'tax_amount' => 200,
            'total_amount' => 2200,
            'paid_amount' => 0,
            'due_amount' => 2200,
            'payment_status' => 'unpaid',
            'source' => 'direct',
        ], $overrides));
    }

    public function test_extend_stay_blocked_when_overlapping_following_booking(): void
    {
        Sanctum::actingAs($this->admin());
        $this->setTaxRate('10');

        $room = $this->room();
        $current = $this->reservation($room);
        $following = $this->reservation($room, [
            'status' => 'confirmed',
            'check_in' => now()->addDays(2)->format('Y-m-d'),
            'check_out' => now()->addDays(4)->format('Y-m-d'),
        ]);

        $response = $this->postJson("/api/reservations/{$current->id}/extend-stay", [
            'new_check_out' => now()->addDays(4)->format('Y-m-d'),
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('message', 'The room is already reserved for another guest during the extended period.');

        $this->assertDatabaseHas('reservations', [
            'id' => $current->id,
            'check_out' => now()->addDays(2)->format('Y-m-d'),
        ]);
        $this->assertDatabaseHas('reservations', [
            'id' => $following->id,
            'status' => 'confirmed',
        ]);
    }

    public function test_extend_stay_allowed_when_no_overlap_and_recalculates_pricing(): void
    {
        Sanctum::actingAs($this->admin());
        $this->setTaxRate('10');

        $reservation = $this->reservation($this->room());
        $newCheckOut = now()->addDays(4)->format('Y-m-d');

        $this->postJson("/api/reservations/{$reservation->id}/extend-stay", [
            'new_check_out' => $newCheckOut,
        ])->assertStatus(200);

        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'check_out' => $newCheckOut,
            'total_nights' => 4,
            'subtotal' => 4000,
            'tax_amount' => 400,
            'total_amount' => 4400,
        ]);
    }

    public function test_extend_stay_rejects_non_checked_in_reservation(): void
    {
        Sanctum::actingAs($this->admin());
        $this->setTaxRate('10');

        $reservation = $this->reservation($this->room(), ['status' => 'confirmed']);

        $this->postJson("/api/reservations/{$reservation->id}/extend-stay", [
            'new_check_out' => now()->addDays(4)->format('Y-m-d'),
        ])->assertStatus(422)
            ->assertJsonPath('message', 'Only checked-in reservations can be extended.');
    }

    public function test_extend_stay_validates_new_check_out_after_current(): void
    {
        Sanctum::actingAs($this->admin());
        $this->setTaxRate('10');

        $reservation = $this->reservation($this->room());

        $this->postJson("/api/reservations/{$reservation->id}/extend-stay", [
            'new_check_out' => now()->addDay()->format('Y-m-d'),
        ])->assertStatus(422)
            ->assertJsonValidationErrors('new_check_out');
    }

    public function test_extend_stay_allowed_when_following_guest_already_checked_out(): void
    {
        Sanctum::actingAs($this->admin());
        $this->setTaxRate('10');

        $room = $this->room();
        $current = $this->reservation($room);
        $this->reservation($room, [
            'status' => 'checked_out',
            'check_in' => now()->addDays(2)->format('Y-m-d'),
            'check_out' => now()->addDays(4)->format('Y-m-d'),
        ]);

        $newCheckOut = now()->addDays(4)->format('Y-m-d');

        $this->postJson("/api/reservations/{$current->id}/extend-stay", [
            'new_check_out' => $newCheckOut,
        ])->assertStatus(200);

        $this->assertDatabaseHas('reservations', [
            'id' => $current->id,
            'check_out' => $newCheckOut,
        ]);
    }
}