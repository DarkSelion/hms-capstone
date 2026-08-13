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

class LateDepartureCheckoutTest extends TestCase
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
     * Checked-in reservation that departed late by 2 days:
     * check_in -4d, check_out -2d, nights 2, subtotal 2000, tax 10% = 2200.
     * The stored total still covers the booked nights only — the check-out
     * flow must bill the actual extra nights.
     */
    protected function lateDepartureReservation(Room $room, array $overrides = []): Reservation
    {
        $guest = $this->guest();
        $id = Reservation::max('id') ?? 0;

        return Reservation::create(array_merge([
            'reservation_number' => 'BK-LDC-' . ($id + 1),
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'status' => 'checked_in',
            'check_in' => now()->subDays(4)->format('Y-m-d'),
            'check_out' => now()->subDays(2)->format('Y-m-d'),
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

    protected function recordPayment(Reservation $reservation, float $amount): Payment
    {
        return Payment::create([
            'reservation_id' => $reservation->id,
            'guest_id' => $reservation->guest_id,
            'amount' => $amount,
            'payment_method' => 'cash',
            'payment_type' => 'full',
            'status' => 'completed',
        ]);
    }

    public function test_late_departure_checkout_bills_actual_nights_through_today_when_settled(): void
    {
        Sanctum::actingAs($this->admin());
        $this->setTaxRate('10');

        $reservation = $this->lateDepartureReservation($this->room());
        $this->recordPayment($reservation, 4400);

        $this->postJson("/api/reservations/{$reservation->id}/check-out")
            ->assertStatus(200)
            ->assertJsonPath('status', 'checked_out');

        $fresh = $reservation->fresh();
        $this->assertEquals(now()->format('Y-m-d'), $fresh->check_out->format('Y-m-d'));
        $this->assertEquals(4, $fresh->total_nights);
        $this->assertEquals(4000, (float) $fresh->subtotal);
        $this->assertEquals(400, (float) $fresh->tax_amount);
        $this->assertEquals(4400, (float) $fresh->total_amount);
        $this->assertEquals(4400, (float) $fresh->paid_amount);
        $this->assertEquals(0, (float) $fresh->due_amount);
        $this->assertEquals('paid', $fresh->payment_status);

        $this->assertDatabaseHas('activity_logs', [
            'action' => 'checked_out',
            'model_id' => $reservation->id,
        ]);
        $this->assertDatabaseMissing('activity_logs', [
            'action' => 'billed_overstay',
        ]);
    }

    public function test_late_departure_checkout_blocked_until_extra_nights_settled(): void
    {
        Sanctum::actingAs($this->admin());
        $this->setTaxRate('10');

        $reservation = $this->lateDepartureReservation($this->room());
        $this->recordPayment($reservation, 2200);

        $this->postJson("/api/reservations/{$reservation->id}/check-out")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Settle the outstanding balance before checking out.');

        $fresh = $reservation->fresh();
        $this->assertEquals('checked_in', $fresh->status);
        $this->assertEquals(now()->subDays(2)->format('Y-m-d'), $fresh->check_out->format('Y-m-d'));
        $this->assertEquals(2200, (float) $fresh->total_amount);
    }

    public function test_on_time_checkout_is_unchanged(): void
    {
        Sanctum::actingAs($this->admin());
        $this->setTaxRate('10');

        $room = $this->room();
        $reservation = $this->lateDepartureReservation($room, [
            'check_in' => now()->subDays(2)->format('Y-m-d'),
            'check_out' => now()->addDay()->format('Y-m-d'),
            'total_nights' => 3,
            'subtotal' => 3000,
            'tax_amount' => 300,
            'total_amount' => 3300,
            'due_amount' => 3300,
        ]);
        $this->recordPayment($reservation, 3300);

        $this->postJson("/api/reservations/{$reservation->id}/check-out")
            ->assertStatus(200);

        $fresh = $reservation->fresh();
        $this->assertEquals(now()->addDay()->format('Y-m-d'), $fresh->check_out->format('Y-m-d'));
        $this->assertEquals(3300, (float) $fresh->total_amount);
        $this->assertEquals('checked_out', $fresh->status);
    }

    public function test_late_departure_checkout_with_custom_departure_date(): void
    {
        Sanctum::actingAs($this->admin());
        $this->setTaxRate('10');

        $reservation = $this->lateDepartureReservation($this->room());
        $this->recordPayment($reservation, 3300);

        $departure = now()->subDay()->format('Y-m-d');

        $this->postJson("/api/reservations/{$reservation->id}/check-out", [
            'actual_check_out' => $departure,
        ])->assertStatus(200);

        $fresh = $reservation->fresh();
        $this->assertEquals($departure, $fresh->check_out->format('Y-m-d'));
        $this->assertEquals(3, $fresh->total_nights);
        $this->assertEquals(3300, (float) $fresh->total_amount);
    }

    public function test_actual_check_out_earlier_than_booked_is_rejected(): void
    {
        Sanctum::actingAs($this->admin());
        $this->setTaxRate('10');

        $reservation = $this->lateDepartureReservation($this->room());
        $this->recordPayment($reservation, 4400);

        $earlier = now()->subDays(3)->format('Y-m-d');

        $this->postJson("/api/reservations/{$reservation->id}/check-out", [
            'actual_check_out' => $earlier,
        ])->assertStatus(422);

        $fresh = $reservation->fresh();
        $this->assertEquals('checked_in', $fresh->status);
        $this->assertEquals(now()->subDays(2)->format('Y-m-d'), $fresh->check_out->format('Y-m-d'));
    }

    public function test_checkout_preview_reports_figures_and_room_overlap(): void
    {
        Sanctum::actingAs($this->admin());
        $this->setTaxRate('10');

        $room = $this->room();
        $reservation = $this->lateDepartureReservation($room);

        Reservation::create([
            'reservation_number' => 'BK-LDC-CONFLICT',
            'guest_id' => $this->guest()->id,
            'room_id' => $room->id,
            'status' => 'confirmed',
            'check_in' => now()->subDays(2)->format('Y-m-d'),
            'check_out' => now()->addDays(2)->format('Y-m-d'),
            'adults' => 2,
            'children' => 0,
            'price_per_night' => 1000,
            'total_nights' => 4,
            'subtotal' => 4000,
            'discount_percent' => 0,
            'discount_amount' => 0,
            'tax_percent' => 10,
            'tax_amount' => 400,
            'total_amount' => 4400,
            'paid_amount' => 0,
            'due_amount' => 4400,
            'payment_status' => 'unpaid',
            'source' => 'direct',
        ]);

        $this->getJson("/api/reservations/{$reservation->id}/checkout-preview")
            ->assertStatus(200)
            ->assertJsonPath('actual_check_out', now()->format('Y-m-d'))
            ->assertJsonPath('total_nights', 4)
            ->assertJsonPath('total_amount', 4400)
            ->assertJsonPath('due_amount', 4400)
            ->assertJsonPath('overlap', true);
    }

    public function test_checkout_preview_no_overlap_and_custom_date(): void
    {
        Sanctum::actingAs($this->admin());
        $this->setTaxRate('10');

        $reservation = $this->lateDepartureReservation($this->room());
        $departure = now()->subDay()->format('Y-m-d');

        $this->getJson("/api/reservations/{$reservation->id}/checkout-preview?actual_check_out={$departure}")
            ->assertStatus(200)
            ->assertJsonPath('actual_check_out', $departure)
            ->assertJsonPath('total_nights', 3)
            ->assertJsonPath('total_amount', 3300)
            ->assertJsonPath('overlap', false);
    }

    public function test_guest_portal_does_not_expose_checkout_preview(): void
    {
        $this->setTaxRate('10');

        $reservation = $this->lateDepartureReservation($this->room());

        Sanctum::actingAs($reservation->guest);

        $this->getJson("/api/reservations/{$reservation->id}/checkout-preview")
            ->assertStatus(403);
    }
}
