<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
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

class LateCheckoutFeeTest extends TestCase
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
     * Checked-in reservation departing TODAY at 2PM hotel time:
     * check_in -2d, check_out today, nights 2, subtotal 2000, tax 10% = 2200.
     */
    protected function departingTodayReservation(Room $room, array $overrides = []): Reservation
    {
        $guest = $this->guest();
        $id = Reservation::max('id') ?? 0;

        return Reservation::create(array_merge([
            'reservation_number' => 'BK-LCO-' . ($id + 1),
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

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_late_checkout_fee_applied_after_cutoff_when_settled(): void
    {
        Sanctum::actingAs($this->admin());
        $this->setTaxRate('10');
        $this->setLateCheckoutFee('500');
        $this->setCheckOutTime('12:00');
        Carbon::setTestNow(now()->setTime(14, 0));

        $reservation = $this->departingTodayReservation($this->room());
        $this->recordPayment($reservation, 2700);

        $this->postJson("/api/reservations/{$reservation->id}/check-out")
            ->assertStatus(200)
            ->assertJsonPath('status', 'checked_out');

        $fresh = $reservation->fresh();
        $this->assertEquals(2700, (float) $fresh->total_amount);
        $this->assertEquals(2700, (float) $fresh->paid_amount);
        $this->assertEquals(0, (float) $fresh->due_amount);
        $this->assertEquals('paid', $fresh->payment_status);

        $this->assertDatabaseHas('activity_logs', [
            'action' => 'late_checkout',
            'model_id' => $reservation->id,
        ]);
    }

    public function test_late_checkout_fee_blocks_until_settled(): void
    {
        Sanctum::actingAs($this->admin());
        $this->setTaxRate('10');
        $this->setLateCheckoutFee('500');
        $this->setCheckOutTime('12:00');
        Carbon::setTestNow(now()->setTime(14, 0));

        $reservation = $this->departingTodayReservation($this->room());
        $this->recordPayment($reservation, 2200);

        $this->postJson("/api/reservations/{$reservation->id}/check-out")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Settle the outstanding balance before checking out.');

        $fresh = $reservation->fresh();
        $this->assertEquals('checked_in', $fresh->status);
        $this->assertEquals(2200, (float) $fresh->total_amount);
    }

    public function test_no_fee_before_cutoff(): void
    {
        Sanctum::actingAs($this->admin());
        $this->setTaxRate('10');
        $this->setLateCheckoutFee('500');
        $this->setCheckOutTime('12:00');
        Carbon::setTestNow(now()->setTime(10, 0));

        $reservation = $this->departingTodayReservation($this->room());
        $this->recordPayment($reservation, 2200);

        $this->postJson("/api/reservations/{$reservation->id}/check-out")
            ->assertStatus(200)
            ->assertJsonPath('status', 'checked_out');

        $fresh = $reservation->fresh();
        $this->assertEquals(2200, (float) $fresh->total_amount);

        $this->assertDatabaseMissing('activity_logs', [
            'action' => 'late_checkout',
            'model_id' => $reservation->id,
        ]);
    }

    public function test_no_fee_when_late_checkout_fee_zero(): void
    {
        Sanctum::actingAs($this->admin());
        $this->setTaxRate('10');
        $this->setLateCheckoutFee('0');
        $this->setCheckOutTime('12:00');
        Carbon::setTestNow(now()->setTime(18, 0));

        $reservation = $this->departingTodayReservation($this->room());
        $this->recordPayment($reservation, 2200);

        $this->postJson("/api/reservations/{$reservation->id}/check-out")
            ->assertStatus(200)
            ->assertJsonPath('status', 'checked_out');

        $fresh = $reservation->fresh();
        $this->assertEquals(2200, (float) $fresh->total_amount);

        $this->assertDatabaseMissing('activity_logs', [
            'action' => 'late_checkout',
            'model_id' => $reservation->id,
        ]);
    }

    public function test_checkout_preview_includes_late_fee(): void
    {
        Sanctum::actingAs($this->admin());
        $this->setTaxRate('10');
        $this->setLateCheckoutFee('500');
        $this->setCheckOutTime('12:00');
        Carbon::setTestNow(now()->setTime(14, 0));

        $reservation = $this->departingTodayReservation($this->room());

        $this->getJson("/api/reservations/{$reservation->id}/checkout-preview")
            ->assertStatus(200)
            ->assertJsonPath('late_checkout_fee', 500)
            ->assertJsonPath('late_checkout_applies', true)
            ->assertJsonPath('total_amount', 2700)
            ->assertJsonPath('due_amount', 2700);
    }

    public function test_no_late_fee_on_overnight_departure(): void
    {
        Sanctum::actingAs($this->admin());
        $this->setTaxRate('10');
        $this->setLateCheckoutFee('500');
        $this->setCheckOutTime('12:00');

        // check_out was 2 days ago -> departing after the booked date, not a
        // same-day late departure. Extra nights are billed, no flat fee.
        $guest = $this->guest();
        $id = Reservation::max('id') ?? 0;
        $reservation = Reservation::create([
            'reservation_number' => 'BK-LCO-' . ($id + 1),
            'guest_id' => $guest->id,
            'room_id' => $this->room()->id,
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
        ]);

        // Preview defaults actual_check_out to today, which differs from the
        // booked check_out -> extra-nights path, no flat fee.
        $this->getJson("/api/reservations/{$reservation->id}/checkout-preview")
            ->assertStatus(200)
            ->assertJsonPath('late_checkout_applies', false)
            ->assertJsonPath('total_nights', 4)
            ->assertJsonPath('total_amount', 4400);

        // Settle through today's total (4 nights) and check out.
        $this->recordPayment($reservation, 4400);
        $this->postJson("/api/reservations/{$reservation->id}/check-out")
            ->assertStatus(200)
            ->assertJsonPath('status', 'checked_out');

        $fresh = $reservation->fresh();
        $this->assertEquals(4, $fresh->total_nights);
        $this->assertEquals(4400, (float) $fresh->total_amount);

        $this->assertDatabaseMissing('activity_logs', [
            'action' => 'late_checkout',
            'model_id' => $reservation->id,
        ]);
        $this->assertDatabaseHas('activity_logs', [
            'action' => 'checked_out',
            'model_id' => $reservation->id,
        ]);
    }

    public function test_late_fee_applied_exactly_once(): void
    {
        Sanctum::actingAs($this->admin());
        $this->setTaxRate('10');
        $this->setLateCheckoutFee('500');
        $this->setCheckOutTime('12:00');
        Carbon::setTestNow(now()->setTime(14, 0));

        $reservation = $this->departingTodayReservation($this->room());
        $this->recordPayment($reservation, 2700);

        $this->postJson("/api/reservations/{$reservation->id}/check-out")->assertStatus(200);

        // Second attempt is rejected (already checked out) and never re-bills.
        $this->postJson("/api/reservations/{$reservation->id}/check-out")->assertStatus(422);

        $fresh = $reservation->fresh();
        $this->assertEquals(2700, (float) $fresh->total_amount);
        $this->assertEquals(1, ActivityLog::where('action', 'late_checkout')
            ->where('model_id', $reservation->id)
            ->count());
    }

    /* ── Overstay detection ─────────────────────────────────────── */

    public function test_overstay_detection_flags_checked_in_past_checkout(): void
    {
        $room = $this->room();
        $guest = $this->guest();
        $id = Reservation::max('id') ?? 0;

        $reservation = Reservation::create([
            'reservation_number' => 'BK-OVR-' . ($id + 1),
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'status' => 'checked_in',
            'check_in' => now()->subDays(3)->format('Y-m-d'),
            'check_out' => now()->subDay()->format('Y-m-d'),
            'adults' => 2,
            'children' => 0,
            'price_per_night' => 1000,
            'total_nights' => 3,
            'subtotal' => 3000,
            'discount_percent' => 0,
            'discount_amount' => 0,
            'tax_percent' => 10,
            'tax_amount' => 300,
            'total_amount' => 3300,
            'paid_amount' => 0,
            'payment_status' => 'unpaid',
            'is_overdue' => false,
        ]);

        $service = new \App\Services\OverdueReservationService();
        $result = $service->detectAndFlagOverdue();

        $reservation->refresh();
        $this->assertTrue($reservation->is_overdue);
        $this->assertNotNull($reservation->overdue_at);
        $this->assertContains($reservation->id, $result['reservation_ids']);
    }

    public function test_overstay_detection_skips_already_flagged(): void
    {
        $room = $this->room();
        $guest = $this->guest();
        $id = Reservation::max('id') ?? 0;

        $reservation = Reservation::create([
            'reservation_number' => 'BK-OVR2-' . ($id + 1),
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'status' => 'checked_in',
            'check_in' => now()->subDays(3)->format('Y-m-d'),
            'check_out' => now()->subDay()->format('Y-m-d'),
            'adults' => 2,
            'children' => 0,
            'price_per_night' => 1000,
            'total_nights' => 3,
            'subtotal' => 3000,
            'discount_percent' => 0,
            'discount_amount' => 0,
            'tax_percent' => 10,
            'tax_amount' => 300,
            'total_amount' => 3300,
            'paid_amount' => 0,
            'payment_status' => 'unpaid',
            'is_overdue' => true,
        ]);

        $service = new \App\Services\OverdueReservationService();
        $result = $service->detectAndFlagOverdue();

        $this->assertNotContains($reservation->id, $result['reservation_ids']);
    }

    public function test_overstay_detection_skips_checked_out(): void
    {
        $room = $this->room();
        $guest = $this->guest();
        $id = Reservation::max('id') ?? 0;

        $reservation = Reservation::create([
            'reservation_number' => 'BK-OVR3-' . ($id + 1),
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'status' => 'checked_out',
            'check_in' => now()->subDays(3)->format('Y-m-d'),
            'check_out' => now()->subDay()->format('Y-m-d'),
            'adults' => 2,
            'children' => 0,
            'price_per_night' => 1000,
            'total_nights' => 3,
            'subtotal' => 3000,
            'discount_percent' => 0,
            'discount_amount' => 0,
            'tax_percent' => 10,
            'tax_amount' => 300,
            'total_amount' => 3300,
            'paid_amount' => 0,
            'payment_status' => 'unpaid',
            'is_overdue' => false,
        ]);

        $service = new \App\Services\OverdueReservationService();
        $result = $service->detectAndFlagOverdue();

        $this->assertNotContains($reservation->id, $result['reservation_ids']);
        $reservation->refresh();
        $this->assertFalse($reservation->is_overdue);
    }

    /* ── Extend preview endpoint ────────────────────────────────── */

    public function test_extend_preview_returns_accurate_pricing(): void
    {
        Sanctum::actingAs($this->admin());
        $this->setTaxRate('10');

        $room = $this->room();
        $guest = $this->guest();
        $id = Reservation::max('id') ?? 0;

        $reservation = Reservation::create([
            'reservation_number' => 'BK-EXT-' . ($id + 1),
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'status' => 'checked_in',
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
            'paid_amount' => 2000,
            'payment_status' => 'partial',
        ]);

        $this->recordPayment($reservation, 2000);

        $newCheckOut = now()->addDays(4)->format('Y-m-d');

        $response = $this->getJson("/api/reservations/{$reservation->id}/extend-preview?new_check_out={$newCheckOut}");
        $response->assertOk();

        $data = $response->json();
        $this->assertEquals(4, $data['current_nights']);
        $this->assertEquals(6, $data['projected_nights']);
        $this->assertEquals(2, $data['extra_nights']);
        $this->assertEquals(2200, $data['extra_amount']);
        $this->assertEquals(6600, $data['projected_total']);
        $this->assertEquals(4600, $data['projected_due']);
        $this->assertEquals(2000, $data['paid_amount']);
        $this->assertFalse($data['overlap']);
    }

    public function test_extend_preview_detects_overlap(): void
    {
        Sanctum::actingAs($this->admin());
        $this->setTaxRate('10');

        $room = $this->room();
        $guest = $this->guest();
        $id = Reservation::max('id') ?? 0;

        // First reservation: check_in today, check_out in 2 days
        $reservation1 = Reservation::create([
            'reservation_number' => 'BK-EXT2-' . ($id + 1),
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
            'paid_amount' => 2200,
            'payment_status' => 'paid',
        ]);

        // Second reservation on same room: check_in in 3 days, check_out in 5 days
        $guest2 = $this->guest();
        $id2 = Reservation::max('id') ?? 0;
        Reservation::create([
            'reservation_number' => 'BK-EXT3-' . ($id2 + 1),
            'guest_id' => $guest2->id,
            'room_id' => $room->id,
            'status' => 'confirmed',
            'check_in' => now()->addDays(3)->format('Y-m-d'),
            'check_out' => now()->addDays(5)->format('Y-m-d'),
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
            'payment_status' => 'unpaid',
        ]);

        // Try to extend reservation1 past reservation2's check_in
        $newCheckOut = now()->addDays(5)->format('Y-m-d');
        $response = $this->getJson("/api/reservations/{$reservation1->id}/extend-preview?new_check_out={$newCheckOut}");
        $response->assertOk();
        $this->assertTrue($response->json('overlap'));
    }

    public function test_extend_preview_rejects_invalid_dates(): void
    {
        Sanctum::actingAs($this->admin());

        $room = $this->room();
        $guest = $this->guest();
        $id = Reservation::max('id') ?? 0;

        $reservation = Reservation::create([
            'reservation_number' => 'BK-EXT4-' . ($id + 1),
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
            'paid_amount' => 0,
            'payment_status' => 'unpaid',
        ]);

        // Same day as current check_out — should fail (must be after)
        $sameDay = now()->format('Y-m-d');
        $this->getJson("/api/reservations/{$reservation->id}/extend-preview?new_check_out={$sameDay}")
            ->assertStatus(422);
    }

    public function test_extend_preview_rejects_non_checked_in(): void
    {
        Sanctum::actingAs($this->admin());

        $room = $this->room();
        $guest = $this->guest();
        $id = Reservation::max('id') ?? 0;

        $reservation = Reservation::create([
            'reservation_number' => 'BK-EXT5-' . ($id + 1),
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'status' => 'confirmed',
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
            'payment_status' => 'unpaid',
        ]);

        $newCheckOut = now()->addDays(4)->format('Y-m-d');
        $this->getJson("/api/reservations/{$reservation->id}/extend-preview?new_check_out={$newCheckOut}")
            ->assertStatus(422);
    }

    /* ── Extend stay after cutoff logging ───────────────────────── */

    public function test_extend_stay_logs_after_cutoff(): void
    {
        Sanctum::actingAs($this->admin());
        $this->setTaxRate('10');
        $this->setCheckOutTime('12:00');
        Carbon::setTestNow(now()->setTime(14, 0));

        $room = $this->room();
        $guest = $this->guest();
        $id = Reservation::max('id') ?? 0;

        $reservation = Reservation::create([
            'reservation_number' => 'BK-EXT6-' . ($id + 1),
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
            'paid_amount' => 2200,
            'payment_status' => 'paid',
        ]);

        $newCheckOut = now()->addDays(1)->format('Y-m-d');
        $this->postJson("/api/reservations/{$reservation->id}/extend-stay", [
            'new_check_out' => $newCheckOut,
        ])->assertOk();

        // Should have late_checkout log because extension was processed after cutoff on the booked check_out date
        $lateLog = ActivityLog::where('action', 'late_checkout')
            ->where('model_id', $reservation->id)
            ->first();
        $this->assertNotNull($lateLog);
        $this->assertStringContainsString('after check-out cutoff', $lateLog->description);
    }
}
