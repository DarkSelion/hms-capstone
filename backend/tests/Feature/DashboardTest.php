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
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    protected function admin(): User
    {
        $role = Role::firstOrCreate(['slug' => 'admin'], ['name' => 'Administrator']);

        return User::create([
            'name' => 'Admin User',
            'email' => uniqid('admin') . '@test.com',
            'password' => Hash::make('password'),
            'role_id' => $role->id,
            'is_active' => true,
        ]);
    }

    protected function staff(): User
    {
        $role = Role::firstOrCreate(['slug' => 'receptionist'], ['name' => 'Receptionist']);

        return User::create([
            'name' => 'Staff User',
            'email' => uniqid('staff') . '@test.com',
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

    protected function roomType(): RoomType
    {
        return RoomType::create([
            'name' => 'Deluxe',
            'slug' => 'deluxe-' . uniqid(),
            'base_price' => 1000,
            'capacity' => 2,
            'max_adults' => 2,
            'max_children' => 1,
            'is_active' => true,
        ]);
    }

    protected function room(array $overrides = []): Room
    {
        return Room::create(array_merge([
            'room_number' => uniqid('R'),
            'room_type_id' => $this->roomType()->id,
            'floor' => 1,
            'status' => 'available',
            'cleaning_status' => 'clean',
            'capacity' => 2,
            'is_active' => true,
        ], $overrides));
    }

    protected function reservation(Room $room, array $overrides = []): Reservation
    {
        $guest = $this->guest();
        $id = Reservation::max('id') ?? 0;

        return Reservation::create(array_merge([
            'reservation_number' => 'BK-DB-' . ($id + 1),
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
            'due_amount' => 2200,
            'payment_status' => 'unpaid',
            'source' => 'direct',
        ], $overrides));
    }

    protected function payment(Reservation $reservation, array $overrides = []): Payment
    {
        return Payment::create(array_merge([
            'reservation_id' => $reservation->id,
            'guest_id' => $reservation->guest_id,
            'amount' => $reservation->total_amount,
            'payment_method' => 'cash',
            'payment_type' => 'reservation',
            'status' => 'completed',
            'notes' => 'Test payment',
        ], $overrides));
    }

    // =========================================================================
    // STATS ENDPOINT
    // =========================================================================

    public function test_stats_returns_all_nine_fields(): void
    {
        Sanctum::actingAs($this->admin());

        $response = $this->getJson('/api/dashboard/stats');

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'today_revenue',
            'occupancy_rate',
            'available_rooms',
            'booked_rooms',
            'check_ins_today',
            'check_outs_today',
            'pending_reservations',
            'total_rooms',
        ]);
    }

    public function test_stats_empty_database(): void
    {
        Sanctum::actingAs($this->admin());

        $response = $this->getJson('/api/dashboard/stats');

        $response->assertStatus(200);
        $response->assertJson([
            'today_revenue' => 0,
            'occupancy_rate' => 0,
            'available_rooms' => 0,
            'booked_rooms' => 0,
            'check_ins_today' => 0,
            'check_outs_today' => 0,
            'pending_reservations' => 0,
            'total_rooms' => 0,
        ]);
    }

    public function test_stats_today_revenue_only_counts_completed_payments(): void
    {
        Sanctum::actingAs($this->admin());
        $room = $this->room();
        $reservation = $this->reservation($room);

        $this->payment($reservation, ['amount' => 1000, 'status' => 'completed']);
        $this->payment($reservation, ['amount' => 500, 'status' => 'pending']);
        $this->payment($reservation, ['amount' => 300, 'status' => 'failed']);

        $response = $this->getJson('/api/dashboard/stats');

        $response->assertStatus(200);
        $response->assertJsonPath('today_revenue', 1000);
    }

    public function test_stats_today_revenue_sums_all_completed_today(): void
    {
        Sanctum::actingAs($this->admin());
        $room1 = $this->room();
        $room2 = $this->room();
        $res1 = $this->reservation($room1);
        $res2 = $this->reservation($room2);

        $this->payment($res1, ['amount' => 1000, 'status' => 'completed']);
        $this->payment($res2, ['amount' => 2500, 'status' => 'completed']);

        $response = $this->getJson('/api/dashboard/stats');

        $response->assertStatus(200);
        $response->assertJsonPath('today_revenue', 3500);
    }

    public function test_stats_zero_total_rooms_handles_division_by_zero(): void
    {
        Sanctum::actingAs($this->admin());

        $response = $this->getJson('/api/dashboard/stats');

        $response->assertStatus(200);
        $response->assertJsonPath('occupancy_rate', 0);
        $response->assertJsonPath('total_rooms', 0);
    }

    public function test_stats_occupancy_rate_calculation(): void
    {
        Sanctum::actingAs($this->admin());
        $this->room(['status' => 'occupied']);
        $this->room(['status' => 'occupied']);
        $this->room(['status' => 'available']);

        $response = $this->getJson('/api/dashboard/stats');

        $response->assertStatus(200);
        $response->assertJsonPath('total_rooms', 3);
        $response->assertJsonPath('available_rooms', 1);
        $response->assertJsonPath('occupancy_rate', 66.67);
    }

    public function test_stats_available_rooms_count(): void
    {
        Sanctum::actingAs($this->admin());
        $this->room(['status' => 'available']);
        $this->room(['status' => 'available']);
        $this->room(['status' => 'occupied']);

        $response = $this->getJson('/api/dashboard/stats');

        $response->assertStatus(200);
        $response->assertJsonPath('available_rooms', 2);
    }

    public function test_stats_booked_rooms_count(): void
    {
        Sanctum::actingAs($this->admin());
        $this->room(['status' => 'occupied']);
        $this->room(['status' => 'reserved']);
        $this->room(['status' => 'available']);

        $response = $this->getJson('/api/dashboard/stats');

        $response->assertStatus(200);
        $response->assertJsonPath('booked_rooms', 2);
    }

    public function test_stats_check_ins_today_excludes_cancelled_no_show(): void
    {
        Sanctum::actingAs($this->admin());
        $room1 = $this->room();
        $room2 = $this->room();
        $room3 = $this->room();
        $this->reservation($room1, ['check_in' => now()->format('Y-m-d'), 'status' => 'confirmed']);
        $this->reservation($room2, ['check_in' => now()->format('Y-m-d'), 'status' => 'cancelled']);
        $this->reservation($room3, ['check_in' => now()->format('Y-m-d'), 'status' => 'no_show']);

        $response = $this->getJson('/api/dashboard/stats');

        $response->assertStatus(200);
        $response->assertJsonPath('check_ins_today', 1);
    }

    public function test_stats_check_ins_today_includes_checked_out(): void
    {
        Sanctum::actingAs($this->admin());
        $room = $this->room();
        $this->reservation($room, ['check_in' => now()->format('Y-m-d'), 'status' => 'checked_out']);

        $response = $this->getJson('/api/dashboard/stats');

        $response->assertStatus(200);
        $response->assertJsonPath('check_ins_today', 1);
    }

    public function test_stats_check_outs_today(): void
    {
        Sanctum::actingAs($this->admin());
        $room1 = $this->room();
        $room2 = $this->room();
        $this->reservation($room1, ['check_out' => now()->format('Y-m-d'), 'status' => 'checked_out']);
        $this->reservation($room2, ['check_out' => now()->format('Y-m-d'), 'status' => 'cancelled']);

        $response = $this->getJson('/api/dashboard/stats');

        $response->assertStatus(200);
        $response->assertJsonPath('check_outs_today', 1);
    }

    public function test_stats_pending_reservations_all_time(): void
    {
        Sanctum::actingAs($this->admin());
        $room1 = $this->room();
        $room2 = $this->room();
        $this->reservation($room1, ['status' => 'pending']);
        $this->reservation($room2, ['status' => 'confirmed']);

        $response = $this->getJson('/api/dashboard/stats');

        $response->assertStatus(200);
        $response->assertJsonPath('pending_reservations', 1);
    }

    // =========================================================================
    // REVENUE ENDPOINT
    // =========================================================================

    public function test_revenue_returns_30_days(): void
    {
        Sanctum::actingAs($this->admin());

        $response = $this->getJson('/api/dashboard/revenue');

        $response->assertStatus(200);
        $data = $response->json();
        $this->assertCount(30, $data);
    }

    public function test_revenue_includes_all_dates_even_without_data(): void
    {
        Sanctum::actingAs($this->admin());

        $response = $this->getJson('/api/dashboard/revenue');

        $response->assertStatus(200);
        $data = $response->json();

        $today = now()->format('Y-m-d');
        $firstDate = now()->subDays(29)->format('Y-m-d');

        $this->assertEquals($firstDate, $data[0]['date']);
        $this->assertEquals($today, $data[29]['date']);

        foreach ($data as $entry) {
            $this->assertEquals(0, $entry['revenue']);
            $this->assertEquals(0, $entry['bookings']);
        }
    }

    public function test_revenue_only_completed_payments(): void
    {
        Sanctum::actingAs($this->admin());
        $room = $this->room();
        $reservation = $this->reservation($room);

        $this->payment($reservation, ['amount' => 1000, 'status' => 'completed']);
        $this->payment($reservation, ['amount' => 500, 'status' => 'pending']);

        $response = $this->getJson('/api/dashboard/revenue');

        $response->assertStatus(200);
        $data = $response->json();

        $todayRevenue = collect($data)->firstWhere('date', now()->format('Y-m-d'));
        $this->assertEquals(1000, $todayRevenue['revenue']);
    }

    public function test_revenue_bookings_count_per_day(): void
    {
        Sanctum::actingAs($this->admin());
        $room1 = $this->room();
        $room2 = $this->room();
        $this->reservation($room1, ['created_at' => now()]);
        $this->reservation($room2, ['created_at' => now()]);

        $response = $this->getJson('/api/dashboard/revenue');

        $response->assertStatus(200);
        $data = $response->json();

        $todayBookings = collect($data)->firstWhere('date', now()->format('Y-m-d'));
        $this->assertEquals(2, $todayBookings['bookings']);
    }

    public function test_revenue_date_range_is_last_30_days(): void
    {
        Sanctum::actingAs($this->admin());

        $response = $this->getJson('/api/dashboard/revenue');

        $response->assertStatus(200);
        $data = $response->json();

        $expectedFirst = now()->subDays(29)->format('Y-m-d');
        $expectedLast = now()->format('Y-m-d');

        $this->assertEquals($expectedFirst, $data[0]['date']);
        $this->assertEquals($expectedLast, $data[29]['date']);
    }

    // =========================================================================
    // OCCUPANCY ENDPOINT
    // =========================================================================

    public function test_occupancy_returns_30_days(): void
    {
        Sanctum::actingAs($this->admin());

        $response = $this->getJson('/api/dashboard/occupancy');

        $response->assertStatus(200);
        $data = $response->json();
        $this->assertCount(30, $data);
    }

    public function test_occupancy_rate_calculation_per_day(): void
    {
        Sanctum::actingAs($this->admin());
        $room1 = $this->room();
        $room2 = $this->room();
        $this->reservation($room1, [
            'status' => 'checked_in',
            'check_in' => now()->subDay()->format('Y-m-d'),
            'check_out' => now()->addDays(2)->format('Y-m-d'),
        ]);

        $response = $this->getJson('/api/dashboard/occupancy');

        $response->assertStatus(200);
        $data = $response->json();

        $today = collect($data)->firstWhere('date', now()->format('Y-m-d'));
        $this->assertEquals(50, $today['rate']);
    }

    public function test_occupancy_confirmed_reservations_counted(): void
    {
        Sanctum::actingAs($this->admin());
        $room1 = $this->room();
        $room2 = $this->room();
        $this->reservation($room1, [
            'status' => 'confirmed',
            'check_in' => now()->subDay()->format('Y-m-d'),
            'check_out' => now()->addDays(2)->format('Y-m-d'),
        ]);

        $response = $this->getJson('/api/dashboard/occupancy');

        $response->assertStatus(200);
        $data = $response->json();

        $today = collect($data)->firstWhere('date', now()->format('Y-m-d'));
        $this->assertEquals(50, $today['rate']);
    }

    public function test_occupancy_no_rooms_zero_rate(): void
    {
        Sanctum::actingAs($this->admin());

        $response = $this->getJson('/api/dashboard/occupancy');

        $response->assertStatus(200);
        $data = $response->json();

        foreach ($data as $entry) {
            $this->assertEquals(0, $entry['rate']);
        }
    }

    // =========================================================================
    // BOOKING SOURCES ENDPOINT
    // =========================================================================

    public function test_booking_sources_groups_by_source(): void
    {
        Sanctum::actingAs($this->admin());
        $room1 = $this->room();
        $room2 = $this->room();
        $room3 = $this->room();
        $this->reservation($room1, ['source' => 'direct']);
        $this->reservation($room2, ['source' => 'direct']);
        $this->reservation($room3, ['source' => 'walk_in']);

        $response = $this->getJson('/api/dashboard/booking-sources');

        $response->assertStatus(200);
        $data = $response->json();
        $this->assertCount(2, $data);
    }

    public function test_booking_sources_ordered_by_count_desc(): void
    {
        Sanctum::actingAs($this->admin());
        $room1 = $this->room();
        $room2 = $this->room();
        $room3 = $this->room();
        $this->reservation($room1, ['source' => 'walk_in']);
        $this->reservation($room2, ['source' => 'direct']);
        $this->reservation($room3, ['source' => 'direct']);

        $response = $this->getJson('/api/dashboard/booking-sources');

        $response->assertStatus(200);
        $data = $response->json();

        $this->assertEquals('direct', $data[0]['source']);
        $this->assertEquals(2, $data[0]['count']);
        $this->assertEquals('walk_in', $data[1]['source']);
        $this->assertEquals(1, $data[1]['count']);
    }

    public function test_booking_sources_empty_when_no_reservations(): void
    {
        Sanctum::actingAs($this->admin());

        $response = $this->getJson('/api/dashboard/booking-sources');

        $response->assertStatus(200);
        $this->assertCount(0, $response->json());
    }

    // =========================================================================
    // RECENT ACTIVITIES ENDPOINT
    // =========================================================================

    public function test_recent_activities_returns_max_10(): void
    {
        Sanctum::actingAs($this->admin());
        $admin = $this->admin();

        for ($i = 0; $i < 15; $i++) {
            ActivityLog::create([
                'user_id' => $admin->id,
                'action' => 'created',
                'module' => 'reservations',
                'description' => "Activity {$i}",
                'created_at' => now()->subMinutes($i),
            ]);
        }

        $response = $this->getJson('/api/dashboard/recent-activities');

        $response->assertStatus(200);
        $this->assertCount(10, $response->json());
    }

    public function test_recent_activities_descending_order(): void
    {
        Sanctum::actingAs($this->admin());
        $admin = $this->admin();

        ActivityLog::create([
            'user_id' => $admin->id,
            'action' => 'created',
            'module' => 'reservations',
            'description' => 'Old activity',
            'created_at' => now()->subMinutes(30),
        ]);
        ActivityLog::create([
            'user_id' => $admin->id,
            'action' => 'created',
            'module' => 'payments',
            'description' => 'New activity',
            'created_at' => now()->subMinutes(5),
        ]);

        $response = $this->getJson('/api/dashboard/recent-activities');

        $response->assertStatus(200);
        $data = $response->json();
        $this->assertEquals('New activity', $data[0]['description']);
        $this->assertEquals('Old activity', $data[1]['description']);
    }

    public function test_recent_activities_eager_loads_user(): void
    {
        Sanctum::actingAs($this->admin());
        $admin = $this->admin();

        ActivityLog::create([
            'user_id' => $admin->id,
            'action' => 'created',
            'module' => 'reservations',
            'description' => 'Test activity',
            'created_at' => now(),
        ]);

        $response = $this->getJson('/api/dashboard/recent-activities');

        $response->assertStatus(200);
        $data = $response->json();
        $this->assertArrayHasKey('user', $data[0]);
        $this->assertEquals('Admin User', $data[0]['user']['name']);
    }

    // =========================================================================
    // TOP ROOM TYPES ENDPOINT
    // =========================================================================

    public function test_top_room_types_current_month_only(): void
    {
        Sanctum::actingAs($this->admin());
        $roomType = $this->roomType();
        $room = $this->room(['room_type_id' => $roomType->id]);

        $this->reservation($room, ['created_at' => now()]);

        $oldRoomType = RoomType::create([
            'name' => 'Old Suite',
            'slug' => 'old-suite-' . uniqid(),
            'base_price' => 2000,
            'capacity' => 3,
            'max_adults' => 3,
            'max_children' => 2,
            'is_active' => true,
        ]);
        $oldRoom = $this->room(['room_type_id' => $oldRoomType->id]);
        $guest = $this->guest();
        $oldCreatedAt = now()->subMonths(3);
        DB::table('reservations')->insert([
            'reservation_number' => 'BK-OLD-' . uniqid(),
            'guest_id' => $guest->id,
            'room_id' => $oldRoom->id,
            'status' => 'confirmed',
            'check_in' => $oldCreatedAt->copy()->format('Y-m-d'),
            'check_out' => $oldCreatedAt->copy()->addDays(2)->format('Y-m-d'),
            'adults' => 2,
            'children' => 0,
            'price_per_night' => 2000,
            'total_nights' => 2,
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
            'created_at' => $oldCreatedAt,
            'updated_at' => $oldCreatedAt,
        ]);

        $response = $this->getJson('/api/dashboard/top-room-types');

        $response->assertStatus(200);
        $data = $response->json();
        $this->assertCount(1, $data);
        $this->assertEquals('Deluxe', $data[0]['name']);
    }

    public function test_top_room_types_ordered_by_count_desc(): void
    {
        Sanctum::actingAs($this->admin());
        $type1 = RoomType::create([
            'name' => 'Suite',
            'slug' => 'suite-' . uniqid(),
            'base_price' => 2000,
            'capacity' => 3,
            'max_adults' => 3,
            'max_children' => 2,
            'is_active' => true,
        ]);
        $type2 = RoomType::create([
            'name' => 'Standard',
            'slug' => 'standard-' . uniqid(),
            'base_price' => 1000,
            'capacity' => 2,
            'max_adults' => 2,
            'max_children' => 1,
            'is_active' => true,
        ]);
        $room1 = $this->room(['room_type_id' => $type1->id]);
        $room2 = $this->room(['room_type_id' => $type2->id]);
        $room3 = $this->room(['room_type_id' => $type2->id]);

        $this->reservation($room1);
        $this->reservation($room2);
        $this->reservation($room3);

        $response = $this->getJson('/api/dashboard/top-room-types');

        $response->assertStatus(200);
        $data = $response->json();
        $this->assertEquals('Standard', $data[0]['name']);
        $this->assertEquals(2, $data[0]['total']);
        $this->assertEquals('Suite', $data[1]['name']);
        $this->assertEquals(1, $data[1]['total']);
    }

    public function test_top_room_types_empty_when_no_reservations_this_month(): void
    {
        Sanctum::actingAs($this->admin());
        $this->roomType();

        $response = $this->getJson('/api/dashboard/top-room-types');

        $response->assertStatus(200);
        $this->assertCount(0, $response->json());
    }

    // =========================================================================
    // AUTH / RBAC
    // =========================================================================

    public function test_dashboard_endpoints_require_authentication(): void
    {
        $this->getJson('/api/dashboard/stats')->assertStatus(401);
        $this->getJson('/api/dashboard/revenue')->assertStatus(401);
        $this->getJson('/api/dashboard/occupancy')->assertStatus(401);
        $this->getJson('/api/dashboard/booking-sources')->assertStatus(401);
        $this->getJson('/api/dashboard/recent-activities')->assertStatus(401);
        $this->getJson('/api/dashboard/top-room-types')->assertStatus(401);
    }

    public function test_dashboard_endpoints_require_staff_role(): void
    {
        $role = Role::firstOrCreate(['slug' => 'guest'], ['name' => 'Guest']);
        $guest = User::create([
            'name' => 'Guest User',
            'email' => 'guest@test.com',
            'password' => Hash::make('password'),
            'role_id' => $role->id,
            'is_active' => true,
        ]);
        Sanctum::actingAs($guest);

        $this->getJson('/api/dashboard/stats')->assertStatus(403);
        $this->getJson('/api/dashboard/revenue')->assertStatus(403);
        $this->getJson('/api/dashboard/occupancy')->assertStatus(403);
        $this->getJson('/api/dashboard/booking-sources')->assertStatus(403);
        $this->getJson('/api/dashboard/recent-activities')->assertStatus(403);
        $this->getJson('/api/dashboard/top-room-types')->assertStatus(403);
    }

    public function test_staff_can_access_dashboard_endpoints(): void
    {
        Sanctum::actingAs($this->staff());

        $this->getJson('/api/dashboard/stats')->assertStatus(200);
        $this->getJson('/api/dashboard/revenue')->assertStatus(200);
        $this->getJson('/api/dashboard/occupancy')->assertStatus(200);
        $this->getJson('/api/dashboard/booking-sources')->assertStatus(200);
        $this->getJson('/api/dashboard/recent-activities')->assertStatus(200);
        $this->getJson('/api/dashboard/top-room-types')->assertStatus(200);
    }
}
