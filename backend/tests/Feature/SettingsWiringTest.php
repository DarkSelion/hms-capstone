<?php

namespace Tests\Feature;

use App\Models\Guest;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\Role;
use App\Models\Room;
use App\Models\RoomType;
use App\Models\Setting;
use App\Models\User;
use App\Console\Commands\CancelOverdueReservations;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;
use ReflectionClass;

class SettingsWiringTest extends TestCase
{
    use RefreshDatabase;

    protected function admin(): User
    {
        $role = Role::firstOrCreate(['slug' => 'admin'], ['name' => 'Admin']);

        return User::create([
            'name' => 'Admin User',
            'email' => uniqid('admin').'@test.com',
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
            'email' => uniqid('guest').'@example.com',
            'phone' => '09171234567',
            'password' => Hash::make('password'),
        ]);
    }

    protected function room(): Room
    {
        $type = RoomType::create([
            'name' => 'Deluxe',
            'slug' => 'deluxe-'.uniqid(),
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
            'capacity' => 2,
            'status' => 'available',
            'is_active' => true,
        ]);
    }

    // ── Late Arrival: auto-compute deadline from setting ────────────────────

    public function test_late_arrival_auto_computes_deadline_from_setting(): void
    {
        Setting::create(['key' => 'late_arrival_hold_hours', 'value' => '24', 'group' => 'booking']);

        $guest = $this->guest();
        $room = $this->room();
        $reservation = Reservation::createWithNumber([
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'status' => 'confirmed',
            'check_in' => now()->subDays(2)->toDateString(),
            'check_out' => now()->addDays(3)->toDateString(),
            'adults' => 2,
            'children' => 0,
            'price_per_night' => 1000,
            'total_nights' => 5,
            'subtotal' => 5000,
            'total_amount' => 5500,
            'paid_amount' => 0,
            'due_amount' => 5500,
            'payment_status' => 'unpaid',
            'is_overdue' => true,
            'overdue_at' => now()->subDays(2)->startOfDay(),
        ]);

        $before = now();
        $response = $this->actingAs($this->admin())
            ->postJson("/api/reservations/{$reservation->id}/late-arrival", []);

        $response->assertOk();
        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => 'late_arrival',
        ]);

        $storedDeadline = $reservation->fresh()->late_arrival_deadline;
        $expectedMin = $before->copy()->addHours(23)->timestamp;
        $expectedMax = $before->copy()->addHours(25)->timestamp;
        $this->assertGreaterThanOrEqual($expectedMin, $storedDeadline->timestamp,
            "Deadline should be at least 23h from now");
        $this->assertLessThanOrEqual($expectedMax, $storedDeadline->timestamp,
            "Deadline should be at most 25h from now");
    }

    public function test_late_arrival_explicit_deadline_overrides_setting(): void
    {
        Setting::create(['key' => 'late_arrival_hold_hours', 'value' => '24', 'group' => 'booking']);

        $guest = $this->guest();
        $room = $this->room();
        $reservation = Reservation::createWithNumber([
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'status' => 'confirmed',
            'check_in' => now()->subDays(2)->toDateString(),
            'check_out' => now()->addDays(3)->toDateString(),
            'adults' => 2,
            'children' => 0,
            'price_per_night' => 1000,
            'total_nights' => 5,
            'subtotal' => 5000,
            'total_amount' => 5500,
            'paid_amount' => 0,
            'due_amount' => 5500,
            'payment_status' => 'unpaid',
            'is_overdue' => true,
            'overdue_at' => now()->subDays(2)->startOfDay(),
        ]);

        $explicitDeadline = now()->addDays(5)->toDateTimeString();
        $response = $this->actingAs($this->admin())
            ->postJson("/api/reservations/{$reservation->id}/late-arrival", [
                'deadline' => $explicitDeadline,
            ]);

        $response->assertOk();
        $this->assertEquals(
            $explicitDeadline,
            $reservation->fresh()->late_arrival_deadline->format('Y-m-d H:i:s')
        );
    }

    // ── Early Check-in Fee ─────────────────────────────────────────────────

    public function test_early_checkin_fee_applied_when_arriving_early(): void
    {
        Setting::create(['key' => 'early_checkin_fee', 'value' => '250', 'group' => 'booking']);

        $guest = $this->guest();
        $room = $this->room();
        $reservation = Reservation::createWithNumber([
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'status' => 'confirmed',
            'check_in' => now()->addDays(3)->toDateString(),
            'check_out' => now()->addDays(5)->toDateString(),
            'adults' => 2,
            'children' => 0,
            'price_per_night' => 1000,
            'total_nights' => 2,
            'subtotal' => 2000,
            'total_amount' => 2200,
            'paid_amount' => 0,
            'due_amount' => 2200,
            'payment_status' => 'unpaid',
        ]);

        // Add a payment so the check-in guard passes
        Payment::create([
            'reservation_id' => $reservation->id,
            'guest_id' => $guest->id,
            'amount' => 2200,
            'payment_method' => 'cash',
            'payment_type' => 'full',
            'status' => 'completed',
            'reference_number' => 'PAY-TEST-001',
        ]);

        $response = $this->actingAs($this->admin())
            ->postJson("/api/reservations/{$reservation->id}/check-in");

        $response->assertOk();

        $refreshed = $reservation->fresh();
        $this->assertEquals(2450.0, (float) $refreshed->total_amount);
        $this->assertEquals(250.0, (float) $refreshed->due_amount);
        $this->assertEquals('partial', $refreshed->payment_status);

        // Invoice created with line item
        $invoice = Invoice::where('reservation_id', $reservation->id)->first();
        $this->assertNotNull($invoice);
        $this->assertEquals(250.0, (float) $invoice->total_amount);

        $item = $invoice->items()->first();
        $this->assertNotNull($item);
        $this->assertEquals('Early check-in fee', $item->description);
        $this->assertEquals(250.0, (float) $item->total_price);
    }

    public function test_early_checkin_fee_not_applied_when_waived(): void
    {
        Setting::create(['key' => 'early_checkin_fee', 'value' => '250', 'group' => 'booking']);

        $guest = $this->guest();
        $room = $this->room();
        $reservation = Reservation::createWithNumber([
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'status' => 'confirmed',
            'check_in' => now()->addDays(3)->toDateString(),
            'check_out' => now()->addDays(5)->toDateString(),
            'adults' => 2,
            'children' => 0,
            'price_per_night' => 1000,
            'total_nights' => 2,
            'subtotal' => 2000,
            'total_amount' => 2200,
            'paid_amount' => 2200,
            'due_amount' => 0,
            'payment_status' => 'paid',
        ]);

        $response = $this->actingAs($this->admin())
            ->postJson("/api/reservations/{$reservation->id}/check-in", [
                'waive_early_checkin_fee' => true,
            ]);

        $response->assertOk();

        $refreshed = $reservation->fresh();
        $this->assertEquals(2200.0, (float) $refreshed->total_amount);
        $this->assertEquals(0.0, (float) $refreshed->due_amount);

        $this->assertDatabaseMissing('invoices', ['reservation_id' => $reservation->id]);
    }

    public function test_early_checkin_fee_not_applied_when_same_day(): void
    {
        Setting::create(['key' => 'early_checkin_fee', 'value' => '250', 'group' => 'booking']);

        $guest = $this->guest();
        $room = $this->room();
        $reservation = Reservation::createWithNumber([
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'status' => 'confirmed',
            'check_in' => now()->toDateString(),
            'check_out' => now()->addDays(2)->toDateString(),
            'adults' => 2,
            'children' => 0,
            'price_per_night' => 1000,
            'total_nights' => 2,
            'subtotal' => 2000,
            'total_amount' => 2200,
            'paid_amount' => 2200,
            'due_amount' => 0,
            'payment_status' => 'paid',
        ]);

        $response = $this->actingAs($this->admin())
            ->postJson("/api/reservations/{$reservation->id}/check-in");

        $response->assertOk();

        $refreshed = $reservation->fresh();
        $this->assertEquals(2200.0, (float) $refreshed->total_amount);

        $this->assertDatabaseMissing('invoices', ['reservation_id' => $reservation->id]);
    }

    public function test_early_checkin_fee_not_applied_when_setting_zero(): void
    {
        Setting::create(['key' => 'early_checkin_fee', 'value' => '0', 'group' => 'booking']);

        $guest = $this->guest();
        $room = $this->room();
        $reservation = Reservation::createWithNumber([
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'status' => 'confirmed',
            'check_in' => now()->addDays(3)->toDateString(),
            'check_out' => now()->addDays(5)->toDateString(),
            'adults' => 2,
            'children' => 0,
            'price_per_night' => 1000,
            'total_nights' => 2,
            'subtotal' => 2000,
            'total_amount' => 2200,
            'paid_amount' => 2200,
            'due_amount' => 0,
            'payment_status' => 'paid',
        ]);

        $response = $this->actingAs($this->admin())
            ->postJson("/api/reservations/{$reservation->id}/check-in");

        $response->assertOk();

        $this->assertEquals(2200.0, (float) $reservation->fresh()->total_amount);
        $this->assertDatabaseMissing('invoices', ['reservation_id' => $reservation->id]);
    }

    // ── Grace Period Minimum Floor ────────────────────────────────────────

    public function test_grace_hours_minimum_is_6(): void
    {
        // Setting says 2 hours — command should clamp to 6
        Setting::create(['key' => 'auto_cancel_grace_hours', 'value' => '2', 'group' => 'booking']);

        $command = new CancelOverdueReservations();
        $ref = new ReflectionClass($command);
        $method = $ref->getMethod('getGraceHours');
        $method->setAccessible(true);

        $result = $method->invoke($command);
        $this->assertEquals(6, $result);
    }

    public function test_grace_hours_above_minimum_passes_through(): void
    {
        Setting::create(['key' => 'auto_cancel_grace_hours', 'value' => '24', 'group' => 'booking']);

        $command = new CancelOverdueReservations();
        $ref = new ReflectionClass($command);
        $method = $ref->getMethod('getGraceHours');
        $method->setAccessible(true);

        $result = $method->invoke($command);
        $this->assertEquals(24, $result);
    }

    public function test_grace_hours_zero_clamps_to_6(): void
    {
        Setting::create(['key' => 'auto_cancel_grace_hours', 'value' => '0', 'group' => 'booking']);

        $command = new CancelOverdueReservations();
        $ref = new ReflectionClass($command);
        $method = $ref->getMethod('getGraceHours');
        $method->setAccessible(true);

        $result = $method->invoke($command);
        $this->assertEquals(6, $result);
    }

    public function test_grace_hours_negative_clamps_to_6(): void
    {
        Setting::create(['key' => 'auto_cancel_grace_hours', 'value' => '-5', 'group' => 'booking']);

        $command = new CancelOverdueReservations();
        $ref = new ReflectionClass($command);
        $method = $ref->getMethod('getGraceHours');
        $method->setAccessible(true);

        $result = $method->invoke($command);
        $this->assertEquals(6, $result);
    }

    // ── Late Arrival Expiry Respects Auto-Cancel Toggle ──────────────────

    public function test_late_arrival_expiry_respects_auto_cancel_disabled(): void
    {
        Setting::create(['key' => 'auto_cancel_enabled', 'value' => '0', 'group' => 'booking']);

        $guest = $this->guest();
        $room = $this->room();

        // Create a late_arrival reservation whose deadline has passed
        $reservation = Reservation::createWithNumber([
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'status' => 'late_arrival',
            'check_in' => now()->subDays(3)->toDateString(),
            'check_out' => now()->addDays(2)->toDateString(),
            'adults' => 2,
            'children' => 0,
            'price_per_night' => 1000,
            'total_nights' => 5,
            'subtotal' => 5000,
            'total_amount' => 5500,
            'paid_amount' => 0,
            'due_amount' => 5500,
            'payment_status' => 'unpaid',
            'late_arrival_deadline' => now()->subHours(2),
            'is_overdue' => false,
        ]);

        // Call expireLateArrivals directly via reflection
        $command = new CancelOverdueReservations();
        $ref = new ReflectionClass($command);
        $method = $ref->getMethod('expireLateArrivals');
        $method->setAccessible(true);

        $expired = $method->invoke($command, now());
        $this->assertEquals(0, $expired);

        // Should NOT be expired — auto_cancel is disabled
        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => 'late_arrival',
        ]);
    }

    public function test_late_arrival_expiry_runs_when_auto_cancel_enabled(): void
    {
        Setting::create(['key' => 'auto_cancel_enabled', 'value' => '1', 'group' => 'booking']);

        $guest = $this->guest();
        $room = $this->room();

        // Create a late_arrival reservation whose deadline has passed
        $reservation = Reservation::createWithNumber([
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'status' => 'late_arrival',
            'check_in' => now()->subDays(3)->toDateString(),
            'check_out' => now()->addDays(2)->toDateString(),
            'adults' => 2,
            'children' => 0,
            'price_per_night' => 1000,
            'total_nights' => 5,
            'subtotal' => 5000,
            'total_amount' => 5500,
            'paid_amount' => 0,
            'due_amount' => 5500,
            'payment_status' => 'unpaid',
            'late_arrival_deadline' => now()->subHours(2),
            'is_overdue' => false,
        ]);

        $command = new CancelOverdueReservations();
        $ref = new ReflectionClass($command);
        $method = $ref->getMethod('expireLateArrivals');
        $method->setAccessible(true);

        $expired = $method->invoke($command, now());
        $this->assertEquals(1, $expired);

        // Should be expired → no_show
        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => 'no_show',
        ]);
    }

    public function test_late_arrival_not_expired_when_deadline_future(): void
    {
        Setting::create(['key' => 'auto_cancel_enabled', 'value' => '1', 'group' => 'booking']);

        $guest = $this->guest();
        $room = $this->room();

        // Deadline is 2 hours from now — should NOT expire
        $reservation = Reservation::createWithNumber([
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'status' => 'late_arrival',
            'check_in' => now()->subDays(3)->toDateString(),
            'check_out' => now()->addDays(2)->toDateString(),
            'adults' => 2,
            'children' => 0,
            'price_per_night' => 1000,
            'total_nights' => 5,
            'subtotal' => 5000,
            'total_amount' => 5500,
            'paid_amount' => 0,
            'due_amount' => 5500,
            'payment_status' => 'unpaid',
            'late_arrival_deadline' => now()->addHours(2),
            'is_overdue' => false,
        ]);

        $command = new CancelOverdueReservations();
        $ref = new ReflectionClass($command);
        $method = $ref->getMethod('expireLateArrivals');
        $method->setAccessible(true);

        $expired = $method->invoke($command, now());
        $this->assertEquals(0, $expired);

        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => 'late_arrival',
        ]);
    }
}
