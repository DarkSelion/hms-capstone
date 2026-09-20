<?php

namespace Tests\Feature;

use App\Models\Reservation;
use App\Models\Room;
use App\Models\RoomType;
use App\Models\Guest;
use App\Models\User;
use App\Models\Role;
use App\Models\ActivityLog;
use App\Models\Setting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class LateArrivalTest extends TestCase
{
    use RefreshDatabase;

    private User $staff;
    private RoomType $roomType;
    private Room $room;

    protected function setUp(): void
    {
        parent::setUp();

        $role = Role::firstOrCreate(['slug' => 'admin'], ['name' => 'Admin']);
        $this->staff = User::factory()->create();
        $this->staff->role()->associate($role)->save();

        $this->roomType = RoomType::create([
            'name' => 'Deluxe',
            'slug' => 'deluxe',
            'description' => 'Deluxe room',
            'base_price' => 1000,
            'capacity' => 2,
            'max_adults' => 2,
            'max_children' => 2,
        ]);
        $this->room = Room::create([
            'room_number' => '101',
            'room_type_id' => $this->roomType->id,
            'status' => 'reserved',
            'floor' => 1,
            'capacity' => 2,
            'is_active' => true,
        ]);

        Setting::create(['key' => 'late_arrival_hold_hours', 'value' => '48', 'group' => 'booking']);
        Setting::create(['key' => 'auto_cancel_enabled', 'value' => '1', 'group' => 'booking']);
    }

    private function createOverdueReservation(string $status = 'confirmed'): Reservation
    {
        $guest = Guest::create([
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => uniqid('guest') . '@example.com',
            'phone' => '09171234567',
            'password' => Hash::make('password'),
        ]);
        return Reservation::createWithNumber([
            'guest_id' => $guest->id,
            'room_id' => $this->room->id,
            'status' => $status,
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
            'is_overdue' => true,
            'overdue_at' => now()->subDays(3)->startOfDay(),
        ]);
    }

    public function test_late_arrival_sets_status_and_deadline(): void
    {
        $reservation = $this->createOverdueReservation();
        $deadline = now()->addDays(2)->toIso8601String();

        $response = $this->actingAs($this->staff)
            ->postJson("/api/reservations/{$reservation->id}/late-arrival", [
                'deadline' => $deadline,
                'notes' => 'Guest called, arriving tomorrow',
            ]);

        $response->assertOk();
        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => 'late_arrival',
            'late_arrival_notes' => 'Guest called, arriving tomorrow',
            'late_arrival_notified_by' => $this->staff->id,
            'is_overdue' => false,
        ]);
    }

    public function test_late_arrival_rejects_non_overdue_confirmed(): void
    {
        $reservation = $this->createOverdueReservation();
        $reservation->update(['is_overdue' => false]);

        $response = $this->actingAs($this->staff)
            ->postJson("/api/reservations/{$reservation->id}/late-arrival", [
                'deadline' => now()->addDays(2)->toIso8601String(),
            ]);

        $response->assertStatus(422);
    }

    public function test_late_arrival_rejects_checked_in_status(): void
    {
        $reservation = $this->createOverdueReservation('checked_in');
        $reservation->update(['is_overdue' => true]);

        $response = $this->actingAs($this->staff)
            ->postJson("/api/reservations/{$reservation->id}/late-arrival", [
                'deadline' => now()->addDays(2)->toIso8601String(),
            ]);

        $response->assertStatus(422);
    }

    public function test_cancel_late_arrival_sets_no_show(): void
    {
        $reservation = $this->createOverdueReservation('late_arrival');
        $reservation->update([
            'late_arrival_deadline' => now()->addDays(2),
            'is_overdue' => false,
        ]);

        $response = $this->actingAs($this->staff)
            ->postJson("/api/reservations/{$reservation->id}/cancel-late-arrival");

        $response->assertOk();
        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => 'no_show',
        ]);
    }

    public function test_cancel_late_arrival_rejects_non_late_arrival(): void
    {
        $reservation = $this->createOverdueReservation('confirmed');

        $response = $this->actingAs($this->staff)
            ->postJson("/api/reservations/{$reservation->id}/cancel-late-arrival");

        $response->assertStatus(422);
    }

    public function test_late_arrival_logs_activity(): void
    {
        $reservation = $this->createOverdueReservation();

        $this->actingAs($this->staff)
            ->postJson("/api/reservations/{$reservation->id}/late-arrival", [
                'deadline' => now()->addDays(2)->toIso8601String(),
            ]);

        $this->assertDatabaseHas('activity_logs', [
            'action' => 'recorded_late_arrival',
            'model_type' => 'Reservation',
            'model_id' => $reservation->id,
        ]);
    }

    public function test_cancel_late_arrival_logs_activity(): void
    {
        $reservation = $this->createOverdueReservation('late_arrival');
        $reservation->update([
            'late_arrival_deadline' => now()->addDays(2),
            'is_overdue' => false,
        ]);

        $this->actingAs($this->staff)
            ->postJson("/api/reservations/{$reservation->id}/cancel-late-arrival");

        $this->assertDatabaseHas('activity_logs', [
            'action' => 'late_arrival_cancelled',
            'model_type' => 'Reservation',
            'model_id' => $reservation->id,
        ]);
    }

    public function test_late_arrival_rejects_past_deadline(): void
    {
        $reservation = $this->createOverdueReservation();

        $response = $this->actingAs($this->staff)
            ->postJson("/api/reservations/{$reservation->id}/late-arrival", [
                'deadline' => now()->subHour()->toIso8601String(),
            ]);

        $response->assertStatus(422);
    }

    public function test_late_arrival_included_in_status_transitions(): void
    {
        $reservation = $this->createOverdueReservation('late_arrival');
        $reservation->update([
            'late_arrival_deadline' => now()->addDays(2),
            'is_overdue' => false,
        ]);

        $response = $this->actingAs($this->staff)
            ->putJson("/api/reservations/{$reservation->id}", [
                'status' => 'no_show',
            ]);

        $response->assertOk();
        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => 'no_show',
        ]);
    }

    public function test_dashboard_includes_overdue_and_late_arrival_counts(): void
    {
        $this->createOverdueReservation('confirmed');
        $lateArrival = $this->createOverdueReservation('confirmed');
        $lateArrival->update([
            'status' => 'late_arrival',
            'is_overdue' => false,
            'late_arrival_deadline' => now()->addDays(2),
        ]);

        $response = $this->actingAs($this->staff)
            ->getJson('/api/dashboard/stats');

        $response->assertOk();
        $data = $response->json();
        $this->assertArrayHasKey('overdue_count', $data);
        $this->assertArrayHasKey('overstay_count', $data);
        $this->assertArrayHasKey('late_arrival_count', $data);
        $this->assertEquals(1, $data['overdue_count']);
        $this->assertEquals(1, $data['late_arrival_count']);
    }
}
