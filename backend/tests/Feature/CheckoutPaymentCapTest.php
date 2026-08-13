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
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The check-out "Collect & Check Out" flow records a payment BEFORE the
 * check-out endpoint folds the projected charges (extra nights from a changed
 * departure, or the same-day late fee) into the reservation totals. The payment
 * endpoint must therefore cap the amount against the PROJECTED balance due when
 * the caller supplies the actual departure date — not the stale stored balance.
 */
class CheckoutPaymentCapTest extends TestCase
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
     * Checked-in reservation departing TODAY: check_in -2d, check_out today,
     * nights 2, subtotal 2000, tax 10% = 2200. Optional payments recorded.
     */
    protected function departingTodayReservation(Room $room, array $payments = []): Reservation
    {
        $guest = $this->guest();
        $id = Reservation::max('id') ?? 0;

        $reservation = Reservation::create([
            'reservation_number' => 'BK-CPC-' . ($id + 1),
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'status' => 'checked_in',
            'check_in' => now()->subDays(2)->format('Y-m-d'),
            'check_out' => now()->format('Y-m-d'),
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
            'paid_amount' => array_sum($payments),
            'due_amount' => max(0, 2200 - array_sum($payments)),
            'payment_status' => array_sum($payments) > 0 ? 'partial' : 'unpaid',
            'source' => 'direct',
        ]);

        foreach ($payments as $amount) {
            Payment::create([
                'reservation_id' => $reservation->id,
                'guest_id' => $guest->id,
                'amount' => $amount,
                'payment_method' => 'cash',
                'payment_type' => 'full',
                'status' => 'completed',
            ]);
        }

        return $reservation;
    }

    /**
     * Checked-in reservation whose booked check-out was 2 days ago (late
     * departure -> extra nights, no flat fee). check_in -4d, nights so far 4,
     * subtotal 4000, tax 10% = 4400.
     */
    protected function lateDepartureReservation(Room $room, array $payments = []): Reservation
    {
        $guest = $this->guest();
        $id = Reservation::max('id') ?? 0;

        $reservation = Reservation::create([
            'reservation_number' => 'BK-CPC-' . ($id + 1),
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
            'paid_amount' => array_sum($payments),
            'due_amount' => max(0, 2200 - array_sum($payments)),
            'payment_status' => array_sum($payments) > 0 ? 'partial' : 'unpaid',
            'source' => 'direct',
        ]);

        foreach ($payments as $amount) {
            Payment::create([
                'reservation_id' => $reservation->id,
                'guest_id' => $guest->id,
                'amount' => $amount,
                'payment_method' => 'cash',
                'payment_type' => 'full',
                'status' => 'completed',
            ]);
        }

        return $reservation;
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_payment_for_projected_late_fee_is_accepted(): void
    {
        Sanctum::actingAs($this->admin());
        $this->setTaxRate('10');
        $this->setLateCheckoutFee('500');
        $this->setCheckOutTime('12:00');
        Carbon::setTestNow(now()->setTime(14, 0));

        // Fully paid at the booked total (2200); the ₱500 same-day late fee is
        // only visible in the projected check-out total.
        $reservation = $this->departingTodayReservation($this->room(), [2200]);

        $this->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'amount' => 500,
            'payment_method' => 'cash',
            'payment_type' => 'full',
            'actual_check_out' => now()->format('Y-m-d'),
        ])
            ->assertStatus(201);

        // The check-out then completes once the fee is settled.
        $this->postJson("/api/reservations/{$reservation->id}/check-out")
            ->assertStatus(200)
            ->assertJsonPath('status', 'checked_out');

        $fresh = $reservation->fresh();
        $this->assertEquals(2700, (float) $fresh->total_amount);
        $this->assertEquals(2700, (float) $fresh->paid_amount);
        $this->assertEquals(0, (float) $fresh->due_amount);
    }

    public function test_payment_without_actual_check_out_keeps_stored_cap(): void
    {
        Sanctum::actingAs($this->admin());
        $this->setTaxRate('10');
        $this->setLateCheckoutFee('500');
        $this->setCheckOutTime('12:00');
        Carbon::setTestNow(now()->setTime(14, 0));

        $reservation = $this->departingTodayReservation($this->room(), [2200]);

        // No departure context -> stored balance (0.00) is the cap, so a
        // standalone payment cannot collect an amount the DB does not know about.
        $this->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'amount' => 500,
            'payment_method' => 'cash',
            'payment_type' => 'full',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('amount');

        $this->assertDatabaseCount('payments', 1);
    }

    public function test_payment_for_projected_extra_nights_is_accepted(): void
    {
        Sanctum::actingAs($this->admin());
        $this->setTaxRate('10');
        $this->setLateCheckoutFee('500');
        $this->setCheckOutTime('12:00');

        // Fully paid at the booked 2-night total (2200); departing today bills
        // 4 nights = 4400, so the projected balance is 2200 extra.
        $reservation = $this->lateDepartureReservation($this->room(), [2200]);

        $this->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'amount' => 2200,
            'payment_method' => 'gcash',
            'payment_type' => 'full',
            'status' => 'completed',
            'actual_check_out' => now()->format('Y-m-d'),
        ])
            ->assertStatus(201);

        $this->postJson("/api/reservations/{$reservation->id}/check-out")
            ->assertStatus(200)
            ->assertJsonPath('status', 'checked_out');

        $fresh = $reservation->fresh();
        $this->assertEquals(4400, (float) $fresh->total_amount);
        $this->assertEquals(4400, (float) $fresh->paid_amount);
        $this->assertEquals(0, (float) $fresh->due_amount);
    }

    public function test_payment_exceeding_projected_due_is_rejected(): void
    {
        Sanctum::actingAs($this->admin());
        $this->setTaxRate('10');
        $this->setLateCheckoutFee('500');
        $this->setCheckOutTime('12:00');
        Carbon::setTestNow(now()->setTime(14, 0));

        $reservation = $this->departingTodayReservation($this->room(), [2200]);

        $this->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'amount' => 600,
            'payment_method' => 'cash',
            'payment_type' => 'full',
            'actual_check_out' => now()->format('Y-m-d'),
        ])
            ->assertStatus(422)
            ->assertJsonPath('errors.amount.0', 'The amount cannot exceed the outstanding balance of 500.00.');

        $this->assertDatabaseCount('payments', 1);
    }

    public function test_plain_partial_payment_without_actual_check_out_still_works(): void
    {
        Sanctum::actingAs($this->admin());
        $this->setTaxRate('10');

        // 165 of 2200 paid -> stored due 2035. A normal partial payment
        // (no departure context) keeps the stored-balance cap.
        $reservation = $this->lateDepartureReservation($this->room(), [165]);

        $this->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'amount' => 200,
            'payment_method' => 'cash',
            'payment_type' => 'partial',
        ])
            ->assertStatus(201);

        $fresh = $reservation->fresh();
        $this->assertEquals(365, (float) $fresh->paid_amount);
        $this->assertEquals(1835, (float) $fresh->due_amount);
    }
}
