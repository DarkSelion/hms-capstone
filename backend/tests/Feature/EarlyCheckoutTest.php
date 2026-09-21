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
use Tests\TestCase;

class EarlyCheckoutTest extends TestCase
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

    protected function setLateCheckoutFee(string $fee): void
    {
        Setting::create(['key' => 'late_checkout_fee', 'value' => $fee, 'group' => 'booking']);
    }

    protected function setCheckOutTime(string $time): void
    {
        Setting::create(['key' => 'check_out_time', 'value' => $time, 'group' => 'booking']);
    }

    /**
     * Checked-in reservation booked check_in -4d, check_out +2d (6 nights total).
     * Price per night: 1000. Total: 6600 (6 * 1000 + 10% tax).
     */
    protected function checkedInReservation(Room $room, array $overrides = []): Reservation
    {
        $guest = $this->guest();
        $id = Reservation::max('id') ?? 0;

        return Reservation::create(array_merge([
            'reservation_number' => 'BK-ECO-' . ($id + 1),
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'status' => 'checked_in',
            'check_in' => now()->subDays(4)->format('Y-m-d'),
            'check_out' => now()->addDays(2)->format('Y-m-d'),
            'adults' => 2,
            'children' => 0,
            'price_per_night' => 1000,
            'total_nights' => 6,
            'subtotal' => 6000,
            'discount_percent' => 0,
            'discount_amount' => 0,
            'tax_percent' => 10,
            'tax_amount' => 600,
            'total_amount' => 6600,
            'paid_amount' => 0,
            'due_amount' => 6600,
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
            'reference_number' => 'PAY-' . uniqid(),
        ]);
    }

    // ── Tests ────────────────────────────────────────────────────────

    public function test_early_check_out_is_allowed(): void
    {
        $admin = $this->admin();
        $room = $this->room();
        $this->setTaxRate('10');
        $reservation = $this->checkedInReservation($room);
        $this->recordPayment($reservation, 6600);

        // Check out 3 days early (today, booked check-out is +2d)
        $response = $this->actingAs($admin)
            ->postJson("/api/reservations/{$reservation->id}/check-out", [
                'actual_check_out' => now()->toDateString(),
            ]);

        $response->assertOk();
        $reservation->refresh();
        $this->assertEquals('checked_out', $reservation->status);
    }

    public function test_early_check_out_keeps_full_booked_amount(): void
    {
        $admin = $this->admin();
        $room = $this->room();
        $this->setTaxRate('10');
        $reservation = $this->checkedInReservation($room);
        $this->recordPayment($reservation, 6600);

        $originalTotal = $reservation->total_amount;

        $response = $this->actingAs($admin)
            ->postJson("/api/reservations/{$reservation->id}/check-out", [
                'actual_check_out' => now()->toDateString(),
            ]);

        $response->assertOk();
        $reservation->refresh();
        $this->assertEquals($originalTotal, $reservation->total_amount, 'Total should stay the same on early departure');
    }

    public function test_early_check_out_room_becomes_dirty(): void
    {
        $admin = $this->admin();
        $room = $this->room();
        $this->setTaxRate('10');
        $reservation = $this->checkedInReservation($room);
        $this->recordPayment($reservation, 6600);

        $response = $this->actingAs($admin)
            ->postJson("/api/reservations/{$reservation->id}/check-out", [
                'actual_check_out' => now()->toDateString(),
            ]);

        $response->assertOk();
        $room->refresh();
        $this->assertEquals('dirty', $room->status);
    }

    public function test_early_check_out_preview_keeps_original_total(): void
    {
        $admin = $this->admin();
        $room = $this->room();
        $this->setTaxRate('10');
        $reservation = $this->checkedInReservation($room);

        $response = $this->actingAs($admin)
            ->getJson("/api/reservations/{$reservation->id}/checkout-preview?actual_check_out=" . now()->toDateString());

        $response->assertOk();
        $data = $response->json();
        $this->assertEqualsWithDelta(6600.0, $data['total_amount'], 0.01);
        $this->assertEqualsWithDelta(6600.0, $data['due_amount'], 0.01);
    }

    public function test_early_departure_sets_correct_check_out_date(): void
    {
        $admin = $this->admin();
        $room = $this->room();
        $this->setTaxRate('10');
        $reservation = $this->checkedInReservation($room);
        $this->recordPayment($reservation, 6600);

        $earlyDate = now()->toDateString();

        $response = $this->actingAs($admin)
            ->postJson("/api/reservations/{$reservation->id}/check-out", [
                'actual_check_out' => $earlyDate,
            ]);

        $response->assertOk();
        $reservation->refresh();
        $this->assertEquals($earlyDate, $reservation->check_out->toDateString());
    }

    public function test_late_checkout_fee_does_not_apply_to_early_departure(): void
    {
        $admin = $this->admin();
        $room = $this->room();
        $this->setTaxRate('10');
        $this->setLateCheckoutFee('500');
        $this->setCheckOutTime('12:00');
        $reservation = $this->checkedInReservation($room);
        $this->recordPayment($reservation, 6600);

        // Check out early (not on the booked check-out date)
        $response = $this->actingAs($admin)
            ->postJson("/api/reservations/{$reservation->id}/check-out", [
                'actual_check_out' => now()->toDateString(),
            ]);

        $response->assertOk();
        $reservation->refresh();
        $this->assertEquals(6600, $reservation->total_amount, 'No late fee on early departure');
    }

    public function test_late_checkout_fee_preview_excludes_early_departure(): void
    {
        $admin = $this->admin();
        $room = $this->room();
        $this->setTaxRate('10');
        $this->setLateCheckoutFee('500');
        $this->setCheckOutTime('12:00');
        $reservation = $this->checkedInReservation($room);

        $response = $this->actingAs($admin)
            ->getJson("/api/reservations/{$reservation->id}/checkout-preview?actual_check_out=" . now()->toDateString());

        $response->assertOk();
        $data = $response->json();
        $this->assertEqualsWithDelta(0.0, $data['late_checkout_fee'], 0.01);
        $this->assertFalse($data['late_checkout_applies']);
    }
}
