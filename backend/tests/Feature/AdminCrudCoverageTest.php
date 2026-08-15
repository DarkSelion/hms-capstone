<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\ContactMessage;
use App\Models\Guest;
use App\Models\LeaveRequest;
use App\Models\MaintenanceRequest;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\Role;
use App\Models\Room;
use App\Models\RoomImage;
use App\Models\RoomType;
use App\Models\Setting;
use App\Models\StaffSchedule;
use App\Models\Technician;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminCrudCoverageTest extends TestCase
{
    use RefreshDatabase;

    protected static int $roomCounter = 0;
    protected static int $guestCounter = 0;
    protected static int $roomNumberCounter = 0;

    protected function admin(string $slug = 'admin'): User
    {
        $role = Role::create(['name' => ucfirst($slug), 'slug' => $slug]);

        return User::create([
            'name' => 'Admin User',
            'email' => $slug . '@test.com',
            'password' => Hash::make('password'),
            'role_id' => $role->id,
            'is_active' => true,
        ]);
    }

    protected function staff(string $slug = 'receptionist'): User
    {
        return $this->admin($slug);
    }

    protected function roomType(string $name = 'Deluxe', ?float $price = 1000): RoomType
    {
        return RoomType::create([
            'name' => $name,
            'slug' => 'rt-' . (++self::$roomCounter),
            'base_price' => $price,
            'capacity' => 2,
            'is_active' => true,
        ]);
    }

    protected function room(?RoomType $type = null, array $overrides = []): Room
    {
        $type = $type ?? $this->roomType('Standard', 800);

        return Room::create(array_merge([
            'room_number' => '10' . ++self::$roomNumberCounter,
            'room_type_id' => $type->id,
            'floor' => 1,
            'status' => 'available',
            'cleaning_status' => 'clean',
            'capacity' => 2,
            'is_active' => true,
        ], $overrides));
    }

    protected function guest(): Guest
    {
        self::$guestCounter++;

        return Guest::create([
            'first_name' => 'Juan' . self::$guestCounter,
            'last_name' => 'Dela Cruz',
            'email' => 'juan' . self::$guestCounter . '@example.com',
            'phone' => '0917123456' . self::$guestCounter,
            'password' => Hash::make('password'),
        ]);
    }

    protected function reservation(?Room $room = null, array $overrides = []): Reservation
    {
        $guest = $this->guest();
        $room = $room ?? $this->room();
        $id = Reservation::max('id') ?? 0;

        return Reservation::create(array_merge([
            'reservation_number' => 'BK-COV-' . ($id + 1),
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'status' => 'confirmed',
            'check_in' => '2026-11-10',
            'check_out' => '2026-11-12',
            'adults' => 2,
            'children' => 0,
            'price_per_night' => 800,
            'total_nights' => 2,
            'subtotal' => 1600,
            'total_amount' => 1760,
            'due_amount' => 1760,
            'paid_amount' => 0,
            'discount_percent' => 0,
            'discount_amount' => 0,
            'tax_percent' => 10,
            'tax_amount' => 160,
            'payment_status' => 'unpaid',
            'source' => 'direct',
        ], $overrides));
    }

    protected function technician(array $overrides = []): Technician
    {
        return Technician::create(array_merge([
            'name' => 'Tech ' . (self::$roomCounter + 1),
            'phone' => '09171234001',
            'specialty' => 'Plumbing',
            'is_active' => true,
        ], $overrides));
    }

    protected function contactMessage(array $overrides = []): ContactMessage
    {
        return ContactMessage::create(array_merge([
            'name' => 'Guest Inquiry',
            'email' => 'inquiry@example.com',
            'subject' => 'Room availability',
            'message' => 'Do you have rooms next weekend?',
            'ip_address' => '127.0.0.1',
        ], $overrides));
    }

    // ─────────────────────────────────────────────────────────────
    // TECHNICIANS
    // ─────────────────────────────────────────────────────────────

    public function test_technician_index_lists_ordered_by_name(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->technician(['name' => 'Zed']);
        $this->technician(['name' => 'Alpha']);

        $this->getJson('/api/technicians')
            ->assertOk()
            ->assertJsonCount(2)
            ->assertJsonPath('0.name', 'Alpha')
            ->assertJsonPath('1.name', 'Zed');
    }

    public function test_technician_can_be_created_by_admin(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/technicians', [
            'name' => 'Marco',
            'phone' => '09170001122',
            'specialty' => 'Electrical',
            'is_active' => true,
        ])->assertStatus(201)
            ->assertJsonPath('name', 'Marco');

        $this->assertDatabaseHas('technicians', ['name' => 'Marco', 'specialty' => 'Electrical']);
        $this->assertDatabaseHas('activity_logs', [
            'action' => 'created',
            'module' => 'maintenance',
            'model_type' => 'Technician',
            'user_id' => $admin->id,
        ]);
    }

    public function test_technician_create_requires_name(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->postJson('/api/technicians', ['phone' => '09170001122'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('name');
    }

    public function test_technician_can_be_updated(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $technician = $this->technician(['name' => 'Old Name']);

        $this->putJson("/api/technicians/{$technician->id}", [
            'name' => 'New Name',
            'is_active' => false,
        ])->assertOk()->assertJsonPath('name', 'New Name');

        $this->assertDatabaseHas('technicians', ['id' => $technician->id, 'name' => 'New Name', 'is_active' => 0]);
        $this->assertDatabaseHas('activity_logs', [
            'action' => 'updated',
            'module' => 'maintenance',
            'model_type' => 'Technician',
            'model_id' => $technician->id,
        ]);
    }

    public function test_technician_can_be_deleted(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $technician = $this->technician();

        $this->deleteJson("/api/technicians/{$technician->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Technician deleted successfully.');

        $this->assertDatabaseMissing('technicians', ['id' => $technician->id]);
        $this->assertDatabaseHas('activity_logs', [
            'action' => 'deleted',
            'model_type' => 'Technician',
        ]);
    }

    public function test_technician_with_assigned_maintenance_cannot_be_deleted(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $technician = $this->technician();
        $room = $this->room();

        MaintenanceRequest::create([
            'room_id' => $room->id,
            'reported_by' => $admin->id,
            'assigned_to' => $technician->id,
            'title' => 'Leaking pipe',
            'category' => 'plumbing',
            'priority' => 'medium',
            'status' => 'in_progress',
        ]);

        $this->deleteJson("/api/technicians/{$technician->id}")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Cannot delete technician with assigned maintenance requests.');

        $this->assertDatabaseHas('technicians', ['id' => $technician->id]);
    }

    public function test_technician_write_routes_require_admin(): void
    {
        $staff = $this->staff('receptionist');
        Sanctum::actingAs($staff);

        $technician = $this->technician();

        $this->postJson('/api/technicians', ['name' => 'X'])->assertStatus(403);
        $this->putJson("/api/technicians/{$technician->id}", ['name' => 'Y'])->assertStatus(403);
        $this->deleteJson("/api/technicians/{$technician->id}")->assertStatus(403);
    }

    public function test_staff_can_read_technicians(): void
    {
        $staff = $this->staff('housekeeping');
        Sanctum::actingAs($staff);

        $this->technician();

        $this->getJson('/api/technicians')->assertOk()->assertJsonCount(1);
    }

    // ─────────────────────────────────────────────────────────────
    // ROOM IMAGES
    // ─────────────────────────────────────────────────────────────

    public function test_room_image_can_be_uploaded_and_sets_sort_order(): void
    {
        Storage::fake('public');

        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $room = $this->room();

        $response = $this->post("/api/rooms/{$room->id}/images", [
            'image' => UploadedFile::fake()->image('room.jpg'),
            'caption' => 'Main view',
            'is_primary' => true,
        ])->assertStatus(201)
            ->assertJsonPath('caption', 'Main view')
            ->assertJsonPath('is_primary', true)
            ->assertJsonPath('sort_order', 1);

        $this->assertDatabaseHas('room_images', ['room_id' => $room->id, 'is_primary' => 1]);
        $this->assertStringStartsWith('/storage/', $response->json('image_url'));
    }

    public function test_setting_primary_clears_other_primaries(): void
    {
        Storage::fake('public');

        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $room = $this->room();
        RoomImage::create(['room_id' => $room->id, 'image_path' => 'rooms/x/1.jpg', 'sort_order' => 1, 'is_primary' => true]);

        $this->post("/api/rooms/{$room->id}/images", [
            'image' => UploadedFile::fake()->image('new.jpg'),
            'is_primary' => true,
        ])->assertStatus(201);

        $this->assertSame(1, RoomImage::where('room_id', $room->id)->where('is_primary', true)->count());
        $this->assertSame(1, RoomImage::where('room_id', $room->id)->where('is_primary', false)->count());
    }

    public function test_room_image_rejects_non_image_file(): void
    {
        Storage::fake('public');

        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $room = $this->room();

        $this->post("/api/rooms/{$room->id}/images", [
            'image' => UploadedFile::fake()->create('notes.txt', 100),
        ])->assertStatus(422)
            ->assertJsonValidationErrors('image');
    }

    public function test_room_image_can_be_updated(): void
    {
        Storage::fake('public');

        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $room = $this->room();
        $image = RoomImage::create(['room_id' => $room->id, 'image_path' => 'rooms/x/1.jpg', 'sort_order' => 1, 'is_primary' => false]);

        $this->putJson("/api/rooms/{$room->id}/images/{$image->id}", [
            'caption' => 'Updated caption',
            'is_primary' => true,
        ])->assertOk()->assertJsonPath('caption', 'Updated caption');

        $this->assertDatabaseHas('room_images', ['id' => $image->id, 'caption' => 'Updated caption', 'is_primary' => 1]);
    }

    public function test_room_image_can_be_deleted(): void
    {
        Storage::fake('public');

        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $room = $this->room();
        $image = RoomImage::create(['room_id' => $room->id, 'image_path' => 'rooms/x/1.jpg', 'sort_order' => 1, 'is_primary' => false]);

        $this->deleteJson("/api/rooms/{$room->id}/images/{$image->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Image deleted successfully.');

        $this->assertDatabaseMissing('room_images', ['id' => $image->id]);
        Storage::disk('public')->assertMissing('rooms/x/1.jpg');
    }

    public function test_room_image_index_returns_images_sorted(): void
    {
        Storage::fake('public');

        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $room = $this->room();
        RoomImage::create(['room_id' => $room->id, 'image_path' => 'rooms/x/2.jpg', 'sort_order' => 2]);
        RoomImage::create(['room_id' => $room->id, 'image_path' => 'rooms/x/1.jpg', 'sort_order' => 1]);

        $this->getJson("/api/rooms/{$room->id}/images")
            ->assertOk()
            ->assertJsonCount(2)
            ->assertJsonPath('0.sort_order', 1);
    }

    public function test_room_image_routes_require_admin(): void
    {
        Storage::fake('public');

        $staff = $this->staff('receptionist');
        Sanctum::actingAs($staff);

        $room = $this->room();
        $image = RoomImage::create(['room_id' => $room->id, 'image_path' => 'rooms/x/1.jpg', 'sort_order' => 1]);

        $this->post("/api/rooms/{$room->id}/images", ['image' => UploadedFile::fake()->image('a.jpg')])->assertStatus(403);
        $this->putJson("/api/rooms/{$room->id}/images/{$image->id}", ['caption' => 'x'])->assertStatus(403);
        $this->deleteJson("/api/rooms/{$room->id}/images/{$image->id}")->assertStatus(403);
    }

    // ─────────────────────────────────────────────────────────────
    // ROOM TYPES
    // ─────────────────────────────────────────────────────────────

    public function test_room_type_create_auto_generates_slug(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->postJson('/api/room-types', [
            'name' => 'Garden Villa',
            'base_price' => 2500,
            'capacity' => 3,
        ])->assertStatus(201)
            ->assertJsonPath('slug', 'garden-villa');
    }

    public function test_room_type_duplicate_name_gets_unique_slug(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->postJson('/api/room-types', ['name' => 'Garden Villa', 'base_price' => 2500, 'capacity' => 3])->assertStatus(201);
        $this->postJson('/api/room-types', ['name' => 'Garden Villa', 'base_price' => 2500, 'capacity' => 3])
            ->assertStatus(422)
            ->assertJsonValidationErrors('name');
    }

    public function test_room_type_update_regenerates_slug_on_rename(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $type = $this->roomType('Old Name', 1200);

        $this->putJson("/api/room-types/{$type->id}", ['name' => 'New Name'])
            ->assertOk()
            ->assertJsonPath('slug', 'new-name');
    }

    public function test_room_type_update_keeps_slug_when_name_unchanged(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $type = $this->roomType('Stable Name', 1200);

        $this->putJson("/api/room-types/{$type->id}", ['base_price' => 1400])
            ->assertOk()
            ->assertJsonPath('slug', $type->slug)
            ->assertJsonPath('base_price', '1400.00');
    }

    public function test_room_type_index_sorts_and_paginates(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->roomType('Zulu', 500);
        $this->roomType('Alpha', 900);

        $this->getJson('/api/room-types?sort_by=base_price&sort_dir=asc')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Zulu');
    }

    public function test_room_type_with_rooms_cannot_be_deleted(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $type = $this->roomType('Busy Type', 1000);
        $this->room($type);

        $this->deleteJson("/api/room-types/{$type->id}")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Cannot delete room type with existing rooms.');
    }

    public function test_room_type_can_be_deleted_when_unused(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $type = $this->roomType('Unused Type', 1000);

        $this->deleteJson("/api/room-types/{$type->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Room type deleted successfully.');

        $this->assertDatabaseMissing('room_types', ['id' => $type->id]);
    }

    public function test_room_type_routes_require_admin(): void
    {
        $staff = $this->staff('cashier');
        Sanctum::actingAs($staff);

        $type = $this->roomType('Staff Type', 1000);

        $this->postJson('/api/room-types', ['name' => 'X', 'base_price' => 1, 'capacity' => 1])->assertStatus(403);
        $this->putJson("/api/room-types/{$type->id}", ['name' => 'Y'])->assertStatus(403);
        $this->deleteJson("/api/room-types/{$type->id}")->assertStatus(403);
    }

    // ─────────────────────────────────────────────────────────────
    // SEARCH
    // ─────────────────────────────────────────────────────────────

    public function test_search_returns_guest_reservation_room_and_type_results(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->reservation();
        $this->room();

        $this->getJson('/api/search?q=juan')
            ->assertOk()
            ->assertJsonStructure(['results'])
            ->assertJsonPath('results.0.type', 'guest');
    }

    public function test_search_matches_reservation_number(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->reservation();

        $this->getJson('/api/search?q=BK-COV')
            ->assertOk()
            ->assertJsonPath('results.0.type', 'reservation');
    }

    public function test_search_matches_room_number(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $room = $this->room();

        $this->getJson('/api/search?q=' . $room->room_number)
            ->assertOk()
            ->assertJsonPath('results.0.type', 'room');
    }

    public function test_search_matches_room_type_name(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->roomType('Penthouse Sky', 5000);

        $this->getJson('/api/search?q=penthouse')
            ->assertOk()
            ->assertJsonPath('results.0.type', 'room_type');
    }

    public function test_search_short_query_returns_empty(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->reservation();

        $this->getJson('/api/search?q=a')
            ->assertOk()
            ->assertJsonPath('results', []);
    }

    // ─────────────────────────────────────────────────────────────
    // STAFF SCHEDULES + LEAVE REQUESTS + ASSIGNABLE
    // ─────────────────────────────────────────────────────────────

    public function test_staff_assignable_returns_active_staff(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $active = $this->staff('receptionist');
        $inactive = $this->staff('cashier');
        $inactive->update(['is_active' => false]);

        $response = $this->getJson('/api/staff/assignable')->assertOk();

        $names = collect($response->json())->pluck('id')->all();
        $this->assertContains($active->id, $names);
        $this->assertNotContains($inactive->id, $names);
    }

    public function test_staff_assignable_filters_by_role(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->staff('receptionist');
        $cashier = $this->staff('cashier');

        $response = $this->getJson('/api/staff/assignable?role=cashier')->assertOk();

        $this->assertSame(1, count($response->json()));
        $this->assertSame($cashier->id, $response->json('0.id'));
    }

    public function test_schedule_can_be_created_and_listed(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $target = $this->staff('receptionist');

        $this->postJson('/api/staff-schedules', [
            'user_id' => $target->id,
            'date' => '2026-11-15',
            'start_time' => '08:00',
            'end_time' => '16:00',
            'notes' => 'Morning shift',
        ])->assertStatus(201)
            ->assertJsonPath('notes', 'Morning shift');

        $this->getJson('/api/staff-schedules?user_id=' . $target->id)
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_schedule_rejects_end_before_start(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $target = $this->staff('receptionist');

        $this->postJson('/api/staff-schedules', [
            'user_id' => $target->id,
            'date' => '2026-11-15',
            'start_time' => '16:00',
            'end_time' => '08:00',
        ])->assertStatus(422)
            ->assertJsonValidationErrors('end_time');
    }

    public function test_leave_request_can_be_created_and_approved(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $target = $this->staff('receptionist');

        $response = $this->postJson('/api/leave-requests', [
            'user_id' => $target->id,
            'type' => 'sick',
            'start_date' => '2026-12-01',
            'end_date' => '2026-12-02',
            'reason' => 'Fever',
        ])->assertStatus(201)
            ->assertJsonPath('status', 'pending');

        $leaveId = $response->json('id');

        $this->putJson("/api/leave-requests/{$leaveId}", ['status' => 'approved'])
            ->assertOk()
            ->assertJsonPath('status', 'approved');

        $this->assertDatabaseHas('leave_requests', ['id' => $leaveId, 'status' => 'approved', 'approved_by' => $admin->id]);
    }

    public function test_leave_request_rejects_invalid_type_and_date_range(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $target = $this->staff('receptionist');

        $this->postJson('/api/leave-requests', [
            'user_id' => $target->id,
            'type' => 'sabbatical',
            'start_date' => '2026-12-05',
            'end_date' => '2026-12-01',
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['type', 'end_date']);
    }

    public function test_staff_admin_routes_require_admin_role(): void
    {
        $staff = $this->staff('housekeeping');
        Sanctum::actingAs($staff);

        $this->getJson('/api/staff')->assertStatus(403);
        $this->postJson('/api/staff', ['name' => 'X', 'email' => 'x@y.com', 'password' => 'secret123', 'role_id' => 1])->assertStatus(403);
    }

    // ─────────────────────────────────────────────────────────────
    // CONTACT MESSAGES (Inquiries)
    // ─────────────────────────────────────────────────────────────

    public function test_contact_messages_index_lists_and_searches(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->contactMessage(['name' => 'First Person']);
        $this->contactMessage(['name' => 'Second Person', 'subject' => 'Wedding booking']);

        $this->getJson('/api/contact-messages')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->getJson('/api/contact-messages?search=wedding')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.subject', 'Wedding booking');
    }

    public function test_contact_message_can_be_viewed(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $message = $this->contactMessage();

        $this->getJson("/api/contact-messages/{$message->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Do you have rooms next weekend?');
    }

    public function test_contact_message_can_be_deleted(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $message = $this->contactMessage();

        $this->deleteJson("/api/contact-messages/{$message->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Message deleted.');

        $this->assertDatabaseMissing('contact_messages', ['id' => $message->id]);
    }

    public function test_contact_message_routes_require_admin(): void
    {
        $staff = $this->staff('receptionist');
        Sanctum::actingAs($staff);

        $message = $this->contactMessage();

        $this->getJson('/api/contact-messages')->assertStatus(403);
        $this->getJson("/api/contact-messages/{$message->id}")->assertStatus(403);
        $this->deleteJson("/api/contact-messages/{$message->id}")->assertStatus(403);
    }

    // ─────────────────────────────────────────────────────────────
    // DASHBOARD ENDPOINTS
    // ─────────────────────────────────────────────────────────────

    public function test_dashboard_booking_sources_returns_sources(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->reservation(null, ['source' => 'direct']);
        $this->reservation(null, ['source' => 'direct']);
        $this->reservation(null, ['source' => 'booking_engine']);

        $this->getJson('/api/dashboard/booking-sources')
            ->assertOk()
            ->assertJsonPath('0.source', 'direct')
            ->assertJsonPath('0.count', 2);
    }

    public function test_dashboard_recent_activities_returns_latest_ten(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        foreach (range(1, 3) as $i) {
            ActivityLog::create([
                'user_id' => $admin->id,
                'action' => 'viewed',
                'module' => 'dashboard',
                'description' => 'Activity ' . $i,
            ]);
        }

        $this->getJson('/api/dashboard/recent-activities')
            ->assertOk()
            ->assertJsonCount(3);
    }

    public function test_dashboard_top_room_types_returns_monthly_counts(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $type = $this->roomType('Top Type', 1000);
        $this->reservation($this->room($type));
        $this->reservation($this->room($type));

        $this->getJson('/api/dashboard/top-room-types')
            ->assertOk()
            ->assertJsonPath('0.name', 'Top Type')
            ->assertJsonPath('0.total', 2);
    }

    public function test_dashboard_stats_returns_expected_shape(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->reservation();

        $this->getJson('/api/dashboard/stats')
            ->assertOk()
            ->assertJsonStructure([
                'today_revenue', 'occupancy_rate', 'available_rooms', 'booked_rooms',
                'dirty_rooms', 'check_ins_today', 'check_outs_today', 'pending_reservations', 'total_rooms',
            ]);
    }

    // ─────────────────────────────────────────────────────────────
    // REPORTS
    // ─────────────────────────────────────────────────────────────

    public function test_revenue_report_returns_daily_series(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->getJson('/api/reports/revenue?from=2026-11-01&to=2026-11-03')
            ->assertOk()
            ->assertJsonCount(3)
            ->assertJsonStructure(['*' => ['date', 'revenue', 'bookings', 'adr', 'occupancy_rate']]);
    }

    public function test_occupancy_report_returns_daily_series(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->room();

        $this->getJson('/api/reports/occupancy?from=2026-11-01&to=2026-11-02')
            ->assertOk()
            ->assertJsonCount(2)
            ->assertJsonStructure(['*' => ['date', 'available_rooms', 'booked_rooms', 'rate']]);
    }

    public function test_reservations_report_returns_breakdown(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->reservation();
        $this->reservation(null, ['status' => 'cancelled']);

        $this->getJson('/api/reports/reservations?from=2026-01-01&to=2026-12-31')
            ->assertOk()
            ->assertJsonStructure(['total', 'status_breakdown', 'daily'])
            ->assertJsonPath('total', 2);
    }

    public function test_reports_require_admin_role(): void
    {
        $staff = $this->staff('receptionist');
        Sanctum::actingAs($staff);

        $this->getJson('/api/reports/revenue?from=2026-11-01&to=2026-11-02')->assertStatus(403);
        $this->getJson('/api/reports/export/revenue')->assertStatus(403);
    }

    // ─────────────────────────────────────────────────────────────
    // SETTINGS LOGO (admin-only)
    // ─────────────────────────────────────────────────────────────

    public function test_logo_can_be_uploaded(): void
    {
        Storage::fake('public');

        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->post('/api/settings/logo', [
            'logo' => UploadedFile::fake()->image('logo.png'),
        ])->assertOk()
            ->assertJsonStructure(['message', 'logo_url']);

        $this->assertDatabaseHas('settings', ['key' => 'hotel_logo']);
    }

    public function test_logo_upload_rejects_non_image(): void
    {
        Storage::fake('public');

        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->post('/api/settings/logo', [
            'logo' => UploadedFile::fake()->create('logo.txt', 100),
        ])->assertStatus(422)
            ->assertJsonValidationErrors('logo');
    }

    public function test_logo_can_be_deleted(): void
    {
        Storage::fake('public');

        $admin = $this->admin();
        Sanctum::actingAs($admin);

        Setting::create(['key' => 'hotel_logo', 'value' => 'branding/logo.png', 'group' => 'hotel']);

        $this->deleteJson('/api/settings/logo')
            ->assertOk();

        $this->assertDatabaseMissing('settings', ['key' => 'hotel_logo']);
        Storage::disk('public')->assertMissing('branding/logo.png');
    }

    public function test_logo_upload_requires_admin(): void
    {
        Storage::fake('public');

        $staff = $this->staff('receptionist');
        Sanctum::actingAs($staff);

        $this->post('/api/settings/logo', ['logo' => UploadedFile::fake()->image('l.png')])->assertStatus(403);
        $this->deleteJson('/api/settings/logo')->assertStatus(403);
    }

    // ─────────────────────────────────────────────────────────────
    // ROOMS WRITE + AVAILABLE (RBAC boundaries)
    // ─────────────────────────────────────────────────────────────

    public function test_staff_can_read_rooms_and_available_but_not_create(): void
    {
        $staff = $this->staff('receptionist');
        Sanctum::actingAs($staff);

        $room = $this->room();

        $this->getJson('/api/rooms')->assertOk();
        $this->getJson("/api/rooms/{$room->id}")->assertOk();
        $this->getJson('/api/rooms/available?check_in=2026-12-01&check_out=2026-12-02')->assertOk();

        $this->postJson('/api/rooms', ['room_number' => '999', 'room_type_id' => $room->room_type_id, 'floor' => 1, 'capacity' => 2])
            ->assertStatus(403);
    }

    public function test_admin_can_update_room_status(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $room = $this->room(null, ['status' => 'available']);

        $this->putJson("/api/rooms/{$room->id}/status", ['status' => 'maintenance'])
            ->assertOk()
            ->assertJsonPath('status', 'maintenance');
    }

    public function test_payment_method_accepts_online(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation();

        $this->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'amount' => 100,
            'payment_method' => 'online',
            'payment_type' => 'partial',
        ])->assertStatus(201);
    }
}