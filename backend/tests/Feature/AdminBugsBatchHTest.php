<?php

namespace Tests\Feature;

use App\Models\Expense;
use App\Models\Guest;
use App\Models\Invoice;
use App\Models\Reservation;
use App\Models\Role;
use App\Models\Room;
use App\Models\RoomType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminBugsBatchHTest extends TestCase
{
    use RefreshDatabase;

    protected static int $roomCounter = 0;
    protected static int $guestCounter = 0;

    protected function admin(): User
    {
        $role = Role::create(['name' => 'Administrator', 'slug' => 'admin']);

        return User::create([
            'name' => 'Admin User',
            'email' => 'admin@test.com',
            'password' => Hash::make('password'),
            'role_id' => $role->id,
            'is_active' => true,
        ]);
    }

    protected function guest(array $overrides = []): Guest
    {
        self::$guestCounter++;

        return Guest::create(array_merge([
            'first_name' => 'Guest' . self::$guestCounter,
            'last_name' => 'Doe',
            'email' => 'guest' . self::$guestCounter . '@example.com',
            'phone' => '0917123456' . self::$guestCounter,
            'password' => Hash::make('password'),
        ], $overrides));
    }

    protected function roomType(string $slug = 'deluxe', ?float $price = 1000): RoomType
    {
        return RoomType::create([
            'name' => 'Deluxe',
            'slug' => $slug,
            'base_price' => $price,
        ]);
    }

    protected function room(?RoomType $type = null, array $overrides = []): Room
    {
        $type = $type ?? $this->roomType('room-type-' . (++self::$roomCounter));

        return Room::create(array_merge([
            'room_number' => '20' . self::$roomCounter,
            'room_type_id' => $type->id,
            'floor' => 2,
            'status' => 'available',
            'capacity' => 2,
            'is_active' => true,
        ], $overrides));
    }

    protected function reservation(?Room $room = null): Reservation
    {
        $guest = $this->guest();
        $room = $room ?? $this->room();
        $id = Reservation::max('id') ?? 0;

        return Reservation::create([
            'reservation_number' => 'BK-BATCH-H-' . ($id + 1),
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'status' => 'confirmed',
            'check_in' => '2026-10-10',
            'check_out' => '2026-10-12',
            'adults' => 2,
            'children' => 0,
            'price_per_night' => 1000,
            'total_nights' => 2,
            'subtotal' => 2000,
            'total_amount' => 2000,
            'due_amount' => 2000,
            'paid_amount' => 0,
            'discount_percent' => 0,
            'discount_amount' => 0,
            'tax_percent' => 0,
            'tax_amount' => 0,
            'payment_status' => 'unpaid',
            'source' => 'direct',
        ]);
    }

    // ── Guest index blacklisted filter ────────────────────────

    public function test_guest_index_filters_blacklisted(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->guest();
        $this->guest(['is_blacklisted' => true, 'blacklist_reason' => 'vandalism']);

        $this->getJson('/api/guests?blacklisted=1')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.is_blacklisted', true);

        $this->getJson('/api/guests')
            ->assertOk()
            ->assertJsonCount(2, 'data');
    }

    // ── Rooms all=1 returns {data:[...]} ──────────────────────

    public function test_rooms_all_returns_data_wrapper(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->room();
        $this->room();

        $response = $this->getJson('/api/rooms?all=1')->assertOk();

        $this->assertArrayHasKey('data', $response->json());
        $this->assertCount(2, $response->json('data'));
    }

    public function test_room_status_can_be_updated_via_update(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $room = $this->room(null, ['status' => 'available']);

        $this->putJson("/api/rooms/{$room->id}", [
            'room_number' => $room->room_number,
            'room_type_id' => $room->room_type_id,
            'floor' => $room->floor,
            'status' => 'maintenance',
        ])->assertOk()->assertJsonPath('status', 'maintenance');
    }

    public function test_room_update_to_available_sets_cleaning_status_clean(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $room = $this->room(null, ['status' => 'dirty', 'cleaning_status' => 'dirty']);

        $this->putJson("/api/rooms/{$room->id}", [
            'room_number' => $room->room_number,
            'room_type_id' => $room->room_type_id,
            'floor' => $room->floor,
            'status' => 'available',
        ])->assertOk()->assertJsonPath('status', 'available')->assertJsonPath('cleaning_status', 'clean');
    }

    public function test_room_update_to_dirty_sets_cleaning_status_dirty(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $room = $this->room(null, ['status' => 'available', 'cleaning_status' => 'clean']);

        $this->putJson("/api/rooms/{$room->id}", [
            'room_number' => $room->room_number,
            'room_type_id' => $room->room_type_id,
            'floor' => $room->floor,
            'status' => 'dirty',
        ])->assertOk()->assertJsonPath('status', 'dirty')->assertJsonPath('cleaning_status', 'dirty');
    }

    public function test_room_update_respects_explicit_cleaning_status(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $room = $this->room(null, ['status' => 'dirty', 'cleaning_status' => 'dirty']);

        $this->putJson("/api/rooms/{$room->id}", [
            'room_number' => $room->room_number,
            'room_type_id' => $room->room_type_id,
            'floor' => $room->floor,
            'status' => 'available',
            'cleaning_status' => 'in_progress',
        ])->assertOk()->assertJsonPath('cleaning_status', 'in_progress');
    }

    public function test_room_status_endpoint_available_sets_cleaning_status_clean(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $room = $this->room(null, ['status' => 'dirty', 'cleaning_status' => 'in_progress']);

        $this->putJson("/api/rooms/{$room->id}/status", [
            'status' => 'available',
        ])->assertOk()->assertJsonPath('status', 'available')->assertJsonPath('cleaning_status', 'clean');
    }

    // ── Invoice index includes items ──────────────────────────

    public function test_invoice_index_includes_items(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation();
        $invoice = Invoice::create([
            'invoice_number' => 'INV-2026-0001',
            'reservation_id' => $reservation->id,
            'guest_id' => $reservation->guest_id,
            'amount' => 2000,
            'tax_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 2000,
            'paid_amount' => 0,
            'due_amount' => 2000,
            'status' => 'draft',
            'issued_date' => '2026-10-10',
            'due_date' => '2026-11-10',
            'created_by' => $admin->id,
        ]);
        $invoice->items()->create([
            'description' => 'Room night',
            'quantity' => 2,
            'unit_price' => 1000,
            'total_price' => 2000,
            'type' => 'service',
        ]);

        $this->getJson('/api/invoices')
            ->assertOk()
            ->assertJsonPath('data.0.items.0.description', 'Room night');
    }

    // ── Expense receipt upload ────────────────────────────────

    public function test_expense_receipt_can_be_uploaded(): void
    {
        Storage::fake('public');

        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $expense = Expense::create([
            'category' => 'supplies',
            'amount' => 150.50,
            'description' => 'Cleaning supplies',
            'date' => '2026-10-01',
            'created_by' => $admin->id,
        ]);

        $response = $this->post("/api/expenses/{$expense->id}/receipt", [
            'receipt' => UploadedFile::fake()->image('receipt.jpg'),
        ])->assertOk()
            ->assertJsonPath('message', 'Receipt uploaded successfully.')
            ->assertJsonStructure(['receipt', 'receipt_url']);

        $this->assertStringStartsWith('http://localhost/storage/receipts/', $response->json('receipt_url'));
        $this->assertDatabaseHas('expenses', ['id' => $expense->id, 'receipt' => $response->json('receipt')]);
        Storage::disk('public')->assertExists($response->json('receipt'));
    }

    public function test_expense_receipt_requires_valid_file(): void
    {
        Storage::fake('public');

        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $expense = Expense::create([
            'category' => 'supplies',
            'amount' => 150.50,
            'date' => '2026-10-01',
            'created_by' => $admin->id,
        ]);

        $this->post("/api/expenses/{$expense->id}/receipt", [
            'receipt' => UploadedFile::fake()->create('note.txt', 10),
        ])->assertStatus(422);

        Storage::disk('public')->assertMissing('receipts/note.txt');
    }

    public function test_expense_receipt_replaces_existing_file(): void
    {
        Storage::fake('public');

        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $expense = Expense::create([
            'category' => 'supplies',
            'amount' => 150.50,
            'date' => '2026-10-01',
            'receipt' => 'receipts/old.pdf',
            'created_by' => $admin->id,
        ]);
        Storage::disk('public')->put('receipts/old.pdf', 'old');

        $response = $this->post("/api/expenses/{$expense->id}/receipt", [
            'receipt' => UploadedFile::fake()->image('new.jpg'),
        ])->assertOk();

        $newPath = $response->json('receipt');
        Storage::disk('public')->assertMissing('receipts/old.pdf');
        $this->assertNotEquals('receipts/old.pdf', $newPath);
        Storage::disk('public')->assertExists($newPath);
        $this->assertDatabaseHas('expenses', ['id' => $expense->id, 'receipt' => $newPath]);
    }

    public function test_non_admin_cannot_upload_receipt(): void
    {
        Storage::fake('public');

        $role = Role::create(['name' => 'Receptionist', 'slug' => 'receptionist']);
        $staff = User::create([
            'name' => 'Staff User',
            'email' => 'staff@test.com',
            'password' => Hash::make('password'),
            'role_id' => $role->id,
            'is_active' => true,
        ]);
        Sanctum::actingAs($staff);

        $expense = Expense::create([
            'category' => 'supplies',
            'amount' => 150.50,
            'date' => '2026-10-01',
            'created_by' => $staff->id,
        ]);

        $this->post("/api/expenses/{$expense->id}/receipt", [
            'receipt' => UploadedFile::fake()->image('receipt.jpg'),
        ])->assertStatus(403);

        Storage::disk('public')->assertMissing('receipts/receipt.jpg');
    }

    public function test_expense_receipt_can_be_removed(): void
    {
        Storage::fake('public');

        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $expense = Expense::create([
            'category' => 'supplies',
            'amount' => 150.50,
            'description' => 'Cleaning supplies',
            'date' => '2026-10-01',
            'created_by' => $admin->id,
        ]);

        $uploaded = $this->post("/api/expenses/{$expense->id}/receipt", [
            'receipt' => UploadedFile::fake()->image('receipt.jpg'),
        ])->assertOk();

        $path = $uploaded->json('receipt');
        Storage::disk('public')->assertExists($path);

        $response = $this->delete("/api/expenses/{$expense->id}/receipt")
            ->assertOk()
            ->assertJsonPath('message', 'Receipt removed successfully.')
            ->assertJsonPath('receipt', null)
            ->assertJsonPath('receipt_url', null);

        Storage::disk('public')->assertMissing($path);
        $this->assertDatabaseHas('expenses', ['id' => $expense->id, 'receipt' => null]);
    }

    public function test_non_admin_cannot_remove_receipt(): void
    {
        Storage::fake('public');

        $role = Role::create(['name' => 'Receptionist', 'slug' => 'receptionist']);
        $staff = User::create([
            'name' => 'Staff User',
            'email' => 'staff@test.com',
            'password' => Hash::make('password'),
            'role_id' => $role->id,
            'is_active' => true,
        ]);
        Sanctum::actingAs($staff);

        $expense = Expense::create([
            'category' => 'supplies',
            'amount' => 150.50,
            'date' => '2026-10-01',
            'created_by' => $staff->id,
            'receipt' => 'receipts/existing.pdf',
        ]);
        Storage::disk('public')->put('receipts/existing.pdf', 'existing');

        $this->delete("/api/expenses/{$expense->id}/receipt")->assertStatus(403);

        Storage::disk('public')->assertExists('receipts/existing.pdf');
        $this->assertDatabaseHas('expenses', ['id' => $expense->id, 'receipt' => 'receipts/existing.pdf']);
    }

    public function test_admin_reservation_store_rejects_adults_over_capacity(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $room = $this->room(null, ['capacity' => 1]);
        $checkIn = now()->addDays(10)->format('Y-m-d');
        $checkOut = now()->addDays(12)->format('Y-m-d');

        $response = $this->postJson('/api/reservations', [
            'guest_first_name' => 'Alice',
            'guest_last_name' => 'Wonder',
            'guest_phone' => '09171234567',
            'room_id' => $room->id,
            'check_in' => $checkIn,
            'check_out' => $checkOut,
            'adults' => 2,
            'children' => 0,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors('adults');

        $this->assertDatabaseMissing('reservations', [
            'room_id' => $room->id,
        ]);
    }

    public function test_admin_reservation_update_rejects_room_below_capacity(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $room = $this->room(null, ['capacity' => 2]);
        $smallRoom = $this->room(null, ['capacity' => 1]);
        $reservation = $this->reservation($room);
        $checkIn = now()->addDays(10)->format('Y-m-d');
        $checkOut = now()->addDays(12)->format('Y-m-d');

        $response = $this->putJson("/api/reservations/{$reservation->id}", [
            'room_id' => $smallRoom->id,
            'check_in' => $checkIn,
            'check_out' => $checkOut,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors('room_id');

        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'room_id' => $room->id,
            'adults' => 2,
        ]);
    }

    public function test_admin_reservation_update_rejects_adults_over_capacity(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $room = $this->room(null, ['capacity' => 1]);
        $reservation = $this->reservation($room);

        $response = $this->putJson("/api/reservations/{$reservation->id}", [
            'adults' => 3,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors('adults');

        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'adults' => 2,
        ]);
    }
}
