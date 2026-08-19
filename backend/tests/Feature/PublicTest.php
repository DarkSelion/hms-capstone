<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\ContactMessage;
use App\Models\Guest;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\Room;
use App\Models\RoomImage;
use App\Models\RoomType;
use App\Models\Role;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PublicTest extends TestCase
{
    use RefreshDatabase;

    protected function guest(array $overrides = []): Guest
    {
        return Guest::create(array_merge([
            'first_name' => 'John',
            'last_name' => 'Travolta',
            'email' => 'john@example.com',
            'phone' => '09171234567',
            'password' => Hash::make('password'),
        ], $overrides));
    }

    protected function roomType(string $slug = 'deluxe', ?float $price = 150): RoomType
    {
        return RoomType::create([
            'name' => ucfirst($slug),
            'slug' => $slug . '-' . uniqid(),
            'description' => 'A nice room',
            'base_price' => $price,
            'capacity' => 2,
            'max_adults' => 2,
            'max_children' => 1,
            'is_active' => true,
            'sort_order' => 1,
        ]);
    }

    protected function room(RoomType $type, array $overrides = []): Room
    {
        return Room::create(array_merge([
            'room_number' => uniqid('R'),
            'room_type_id' => $type->id,
            'floor' => 1,
            'status' => 'available',
            'cleaning_status' => 'clean',
            'capacity' => 2,
            'is_active' => true,
        ], $overrides));
    }

    protected function setupSettings(): void
    {
        Setting::create(['key' => 'hotel_name', 'value' => 'Pampanga Home Suites', 'group' => 'hotel']);
        Setting::create(['key' => 'tax_rate', 'value' => '10', 'group' => 'tax']);
        Setting::create(['key' => 'max_advance_days', 'value' => '30', 'group' => 'booking']);
    }

    protected function makeReservation(array $overrides = []): Reservation
    {
        $guest = $this->guest(['email' => 'res_guest@example.com']);
        $type = $this->roomType('suite', 200);
        $room = $this->room($type);

        $checkIn = now()->addDays(10)->format('Y-m-d');
        $checkOut = now()->addDays(12)->format('Y-m-d');

        return Reservation::create(array_merge([
            'reservation_number' => 'BK-' . now()->year . '-' . random_int(1000, 9999),
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'status' => 'confirmed',
            'check_in' => $checkIn,
            'check_out' => $checkOut,
            'adults' => 2,
            'children' => 0,
            'price_per_night' => 200,
            'total_nights' => 2,
            'subtotal' => 400,
            'discount_percent' => 0,
            'discount_amount' => 0,
            'tax_percent' => 10,
            'tax_amount' => 40,
            'total_amount' => 440,
            'paid_amount' => 0,
            'due_amount' => 440,
            'payment_status' => 'unpaid',
            'source' => 'booking_engine',
        ], $overrides));
    }

    // =========================================================================
    // AUTH: REGISTRATION
    // =========================================================================

    public function test_public_registration_success(): void
    {
        $response = $this->postJson('/api/public/register', [
            'first_name' => 'Alice',
            'last_name' => 'Wonder',
            'email' => 'alice@example.com',
            'phone' => '09171112222',
            'password' => 'secret123',
            'password_confirmation' => 'secret123',
            'gender' => 'female',
        ]);

        $response->assertStatus(201)
            ->assertJsonStructure(['token', 'user'])
            ->assertJsonPath('user.first_name', 'Alice')
            ->assertJsonPath('user.last_name', 'Wonder');
    }

    public function test_public_registration_validation_errors(): void
    {
        $response = $this->postJson('/api/public/register', [
            'first_name' => 'A',
            'email' => 'not-an-email',
            'password' => 'short',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['last_name', 'email', 'password', 'phone']);
    }

    public function test_public_registration_duplicate_email(): void
    {
        $this->guest(['email' => 'taken@example.com']);

        $response = $this->postJson('/api/public/register', [
            'first_name' => 'Bob',
            'last_name' => 'Builder',
            'email' => 'taken@example.com',
            'phone' => '09172223333',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    // =========================================================================
    // AUTH: LOGIN
    // =========================================================================

    public function test_public_login_success(): void
    {
        $guest = $this->guest(['password' => Hash::make('secret123')]);

        $response = $this->postJson('/api/public/login', [
            'email' => $guest->email,
            'password' => 'secret123',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure(['token', 'user'])
            ->assertJsonPath('user.email', $guest->email);
    }

    public function test_public_login_wrong_email(): void
    {
        $response = $this->postJson('/api/public/login', [
            'email' => 'nobody@example.com',
            'password' => 'secret123',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_public_login_wrong_password(): void
    {
        $guest = $this->guest(['password' => Hash::make('correct123')]);

        $response = $this->postJson('/api/public/login', [
            'email' => $guest->email,
            'password' => 'wrong',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_public_login_blacklisted_guest_blocked(): void
    {
        $guest = $this->guest(['password' => Hash::make('secret123'), 'is_blacklisted' => true]);

        $response = $this->postJson('/api/public/login', [
            'email' => $guest->email,
            'password' => 'secret123',
        ]);

        $response->assertStatus(403)
            ->assertJsonPath('message', 'Account has been deactivated. Please contact support.');
    }

    public function test_public_login_validation_errors(): void
    {
        $response = $this->postJson('/api/public/login', []);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email', 'password']);
    }

    // =========================================================================
    // AUTH: ME / LOGOUT
    // =========================================================================

    public function test_public_me_requires_auth(): void
    {
        $this->getJson('/api/public/me')->assertStatus(401);
    }

    public function test_public_me_returns_guest(): void
    {
        $guest = $this->guest();
        Sanctum::actingAs($guest);

        $this->getJson('/api/public/me')
            ->assertStatus(200)
            ->assertJsonPath('email', $guest->email)
            ->assertJsonPath('first_name', 'John');
    }

    public function test_public_logout_revokes_token(): void
    {
        $guest = $this->guest();
        Sanctum::actingAs($guest);

        $this->postJson('/api/public/logout')
            ->assertStatus(200)
            ->assertJsonPath('message', 'Logged out successfully.');

        $this->assertCount(0, $guest->tokens);
    }

    // =========================================================================
    // AUTH: PROFILE UPDATE
    // =========================================================================

    public function test_public_profile_update_success(): void
    {
        $guest = $this->guest();
        Sanctum::actingAs($guest);

        $response = $this->putJson('/api/public/profile', [
            'first_name' => 'Updated',
            'last_name' => 'Name',
            'phone' => '09187654321',
            'city' => 'Manila',
            'country' => 'Philippines',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('first_name', 'Updated')
            ->assertJsonPath('city', 'Manila');

        $this->assertDatabaseHas('guests', [
            'id' => $guest->id,
            'first_name' => 'Updated',
            'city' => 'Manila',
        ]);
    }

    public function test_public_profile_update_empty_strings_to_null(): void
    {
        $guest = $this->guest(['city' => 'Manila', 'address' => '123 St']);
        Sanctum::actingAs($guest);

        $this->putJson('/api/public/profile', [
            'city' => '',
            'address' => '',
        ])->assertStatus(200);

        $this->assertNull($guest->fresh()->city);
        $this->assertNull($guest->fresh()->address);
    }

    public function test_public_profile_update_duplicate_email(): void
    {
        $this->guest(['email' => 'taken@example.com']);
        $guest = $this->guest(['email' => 'myname@example.com']);
        Sanctum::actingAs($guest);

        $response = $this->putJson('/api/public/profile', [
            'email' => 'taken@example.com',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_public_profile_update_requires_auth(): void
    {
        $this->putJson('/api/public/profile', ['first_name' => 'Test'])
            ->assertStatus(401);
    }

    // =========================================================================
    // AUTH: PASSWORD UPDATE
    // =========================================================================

    public function test_public_password_update_success(): void
    {
        $guest = $this->guest(['password' => Hash::make('oldpass123')]);
        Sanctum::actingAs($guest);

        $this->putJson('/api/public/password', [
            'current_password' => 'oldpass123',
            'password' => 'newpass123',
            'password_confirmation' => 'newpass123',
        ])->assertStatus(200)
            ->assertJsonPath('message', 'Password updated successfully.');

        $this->assertTrue(Hash::check('newpass123', $guest->fresh()->password));
    }

    public function test_public_password_update_wrong_current(): void
    {
        $guest = $this->guest(['password' => Hash::make('correct123')]);
        Sanctum::actingAs($guest);

        $response = $this->putJson('/api/public/password', [
            'current_password' => 'wrongpass',
            'password' => 'newpass123',
            'password_confirmation' => 'newpass123',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors('current_password');
    }

    public function test_public_password_update_validation(): void
    {
        $guest = $this->guest();
        Sanctum::actingAs($guest);

        $response = $this->putJson('/api/public/password', [
            'current_password' => 'password',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['password']);
    }

    // =========================================================================
    // AUTH: DELETE ACCOUNT
    // =========================================================================

    public function test_public_delete_account_without_history(): void
    {
        $guest = $this->guest();
        Sanctum::actingAs($guest);

        $this->deleteJson('/api/public/profile')
            ->assertStatus(200)
            ->assertJsonPath('message', 'Account deleted successfully.');

        $this->assertDatabaseMissing('guests', ['id' => $guest->id]);
    }

    public function test_public_delete_account_with_reservation_history(): void
    {
        $guest = $this->guest(['email' => 'history@example.com']);
        $type = $this->roomType('deluxe', 100);
        $room = $this->room($type);
        Reservation::create([
            'reservation_number' => 'BK-' . now()->year . '-0001',
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'status' => 'confirmed',
            'check_in' => '2026-09-10',
            'check_out' => '2026-09-12',
            'adults' => 2,
            'price_per_night' => 100,
            'total_nights' => 2,
            'subtotal' => 200,
            'tax_amount' => 20,
            'total_amount' => 220,
            'due_amount' => 220,
            'payment_status' => 'unpaid',
            'source' => 'booking_engine',
        ]);

        Sanctum::actingAs($guest);

        $response = $this->deleteJson('/api/public/profile');

        $response->assertStatus(422)
            ->assertJsonPath('message', 'Cannot delete account with reservation history. Please contact support.');

        $this->assertDatabaseHas('guests', ['id' => $guest->id]);
    }

    // =========================================================================
    // ROOMS: LIST
    // =========================================================================

    public function test_public_rooms_list_returns_active_types(): void
    {
        $type = $this->roomType('deluxe', 150);
        $this->room($type);

        $inactiveType = RoomType::create([
            'name' => 'Inactive',
            'slug' => 'inactive-' . uniqid(),
            'base_price' => 100,
            'capacity' => 2,
            'is_active' => false,
            'sort_order' => 2,
        ]);
        $this->room($inactiveType);

        $response = $this->getJson('/api/public/rooms');

        $response->assertStatus(200);
        $data = $response->json();
        $this->assertCount(1, $data);
        $this->assertEquals($type->slug, $data[0]['slug']);
    }

    public function test_public_rooms_list_with_availability_filter(): void
    {
        $type = $this->roomType('deluxe', 150);
        $room = $this->room($type);

        Reservation::create([
            'reservation_number' => 'BK-' . now()->year . '-0010',
            'guest_id' => $this->guest()->id,
            'room_id' => $room->id,
            'status' => 'confirmed',
            'check_in' => '2026-10-10',
            'check_out' => '2026-10-12',
            'adults' => 2,
            'price_per_night' => 150,
            'total_nights' => 2,
            'subtotal' => 300,
            'tax_amount' => 30,
            'total_amount' => 330,
            'due_amount' => 330,
            'payment_status' => 'unpaid',
            'source' => 'booking_engine',
        ]);

        $response = $this->getJson('/api/public/rooms?check_in=2026-10-09&check_out=2026-10-11');

        $response->assertStatus(200);
        $this->assertCount(0, $response->json());
    }

    public function test_public_rooms_list_excludes_types_with_no_available_rooms(): void
    {
        $type = $this->roomType('suite', 500);
        $room = $this->room($type);

        Reservation::create([
            'reservation_number' => 'BK-' . now()->year . '-0020',
            'guest_id' => $this->guest()->id,
            'room_id' => $room->id,
            'status' => 'confirmed',
            'check_in' => '2026-11-01',
            'check_out' => '2026-11-05',
            'adults' => 2,
            'price_per_night' => 500,
            'total_nights' => 4,
            'subtotal' => 2000,
            'tax_amount' => 200,
            'total_amount' => 2200,
            'due_amount' => 2200,
            'payment_status' => 'unpaid',
            'source' => 'booking_engine',
        ]);

        $response = $this->getJson('/api/public/rooms?check_in=2026-10-30&check_out=2026-11-03');

        $response->assertStatus(200);
        $this->assertCount(0, $response->json());
    }

    public function test_public_rooms_list_excludes_cancelled_reservations(): void
    {
        $type = $this->roomType('deluxe', 150);
        $room = $this->room($type);

        Reservation::create([
            'reservation_number' => 'BK-' . now()->year . '-0030',
            'guest_id' => $this->guest()->id,
            'room_id' => $room->id,
            'status' => 'cancelled',
            'check_in' => '2026-10-10',
            'check_out' => '2026-10-12',
            'adults' => 2,
            'price_per_night' => 150,
            'total_nights' => 2,
            'subtotal' => 300,
            'tax_amount' => 30,
            'total_amount' => 330,
            'due_amount' => 330,
            'payment_status' => 'unpaid',
            'source' => 'booking_engine',
        ]);

        $response = $this->getJson('/api/public/rooms?check_in=2026-10-09&check_out=2026-10-11');

        $response->assertStatus(200);
        $this->assertCount(1, $response->json());
    }

    // =========================================================================
    // ROOMS: DETAIL (slug)
    // =========================================================================

    public function test_public_room_detail_by_slug(): void
    {
        $type = $this->roomType('deluxe', 150);
        $room = $this->room($type);
        RoomImage::create([
            'room_id' => $room->id,
            'image_path' => 'branding/test.jpg',
            'is_primary' => true,
        ]);

        $response = $this->getJson('/api/public/rooms/' . $type->slug);

        $response->assertStatus(200)
            ->assertJsonPath('slug', $type->slug)
            ->assertJsonPath('base_price', '150.00')
            ->assertJsonStructure(['rooms', 'rooms_count', 'image_url']);
    }

    public function test_public_room_detail_not_found(): void
    {
        $this->getJson('/api/public/rooms/nonexistent')->assertStatus(404);
    }

    public function test_public_room_detail_inactive_hidden(): void
    {
        $type = RoomType::create([
            'name' => 'Hidden',
            'slug' => 'hidden-' . uniqid(),
            'base_price' => 100,
            'is_active' => false,
        ]);

        $this->getJson('/api/public/rooms/' . $type->slug)->assertStatus(404);
    }

    // =========================================================================
    // ROOMS: AVAILABLE
    // =========================================================================

    public function test_public_available_rooms(): void
    {
        $type = $this->roomType('deluxe', 150);
        $room = $this->room($type);

        $response = $this->getJson('/api/public/rooms/available?check_in=2026-10-10&check_out=2026-10-12');

        $response->assertStatus(200);
        $data = $response->json();
        $this->assertCount(1, $data);
        $this->assertEquals($room->id, $data[0]['id']);
        $this->assertEquals('150.00', $data[0]['room_type']['base_price']);
    }

    public function test_public_available_rooms_filters_booked(): void
    {
        $type = $this->roomType('deluxe', 150);
        $room = $this->room($type);

        Reservation::create([
            'reservation_number' => 'BK-' . now()->year . '-0040',
            'guest_id' => $this->guest()->id,
            'room_id' => $room->id,
            'status' => 'confirmed',
            'check_in' => '2026-10-10',
            'check_out' => '2026-10-12',
            'adults' => 2,
            'price_per_night' => 150,
            'total_nights' => 2,
            'subtotal' => 300,
            'tax_amount' => 30,
            'total_amount' => 330,
            'due_amount' => 330,
            'payment_status' => 'unpaid',
            'source' => 'booking_engine',
        ]);

        $response = $this->getJson('/api/public/rooms/available?check_in=2026-10-09&check_out=2026-10-13');

        $response->assertStatus(200);
        $this->assertCount(0, $response->json());
    }

    public function test_public_available_rooms_ignores_no_show_reservations(): void
    {
        $type = $this->roomType('deluxe', 150);
        $room = $this->room($type);

        Reservation::create([
            'reservation_number' => 'BK-' . now()->year . '-0041',
            'guest_id' => $this->guest()->id,
            'room_id' => $room->id,
            'status' => 'no_show',
            'check_in' => '2026-10-10',
            'check_out' => '2026-10-12',
            'adults' => 2,
            'price_per_night' => 150,
            'total_nights' => 2,
            'subtotal' => 300,
            'tax_amount' => 30,
            'total_amount' => 330,
            'due_amount' => 330,
            'payment_status' => 'unpaid',
            'source' => 'booking_engine',
        ]);

        $response = $this->getJson('/api/public/rooms/available?check_in=2026-10-09&check_out=2026-10-13');

        $response->assertStatus(200);
        $this->assertCount(1, $response->json());
        $this->assertEquals($room->id, $response->json()[0]['id']);
    }

    public function test_public_available_rooms_by_type(): void
    {
        $deluxe = $this->roomType('deluxe', 150);
        $suite = $this->roomType('suite', 300);
        $this->room($deluxe);
        $this->room($suite);

        $response = $this->getJson("/api/public/rooms/available?check_in=2026-10-10&check_out=2026-10-12&room_type_id={$deluxe->id}");

        $response->assertStatus(200);
        $this->assertCount(1, $response->json());
        $this->assertEquals($deluxe->id, $response->json()[0]['room_type_id']);
    }

    public function test_public_available_rooms_validation(): void
    {
        $response = $this->getJson('/api/public/rooms/available?check_in=2026-10-10');

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['check_out']);
    }

    // =========================================================================
    // RESERVATIONS: CREATE
    // =========================================================================

    public function test_public_reservation_create_success(): void
    {
        $this->setupSettings();
        $type = $this->roomType('deluxe', 150);
        $room = $this->room($type);
        $guest = $this->guest();
        Sanctum::actingAs($guest);

        $checkIn = now()->addDays(10)->format('Y-m-d');
        $checkOut = now()->addDays(12)->format('Y-m-d');

        $response = $this->postJson('/api/public/reservations', [
            'room_type_id' => $type->id,
            'check_in' => $checkIn,
            'check_out' => $checkOut,
            'adults' => 2,
            'children' => 1,
            'special_requests' => 'Late check-in',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('status', 'confirmed')
            ->assertJsonPath('total_amount', '330.00')
            ->assertJsonPath('tax_amount', '30.00')
            ->assertJsonPath('price_per_night', '150.00')
            ->assertJsonPath('room.room_type_id', $type->id);

        $this->assertDatabaseHas('reservations', [
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'status' => 'confirmed',
        ]);

        $this->assertDatabaseHas('rooms', [
            'id' => $room->id,
            'status' => 'reserved',
        ]);
    }

    public function test_public_reservation_rejects_adults_over_room_capacity(): void
    {
        $this->setupSettings();
        $type = $this->roomType('deluxe', 150);
        $this->room($type);
        $guest = $this->guest();
        Sanctum::actingAs($guest);

        $checkIn = now()->addDays(10)->format('Y-m-d');
        $checkOut = now()->addDays(12)->format('Y-m-d');

        $response = $this->postJson('/api/public/reservations', [
            'room_type_id' => $type->id,
            'check_in' => $checkIn,
            'check_out' => $checkOut,
            'adults' => 5,
            'children' => 1,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors('adults');

        $this->assertDatabaseMissing('reservations', [
            'room_type_id' => $type->id,
        ]);
    }

    public function test_public_reservation_requires_auth(): void
    {
        $type = $this->roomType('deluxe', 150);
        $this->room($type);

        $response = $this->postJson('/api/public/reservations', [
            'room_type_id' => $type->id,
            'check_in' => '2026-10-10',
            'check_out' => '2026-10-12',
            'adults' => 2,
        ]);

        $response->assertStatus(401);
    }

    public function test_public_reservation_check_out_before_check_in(): void
    {
        $this->setupSettings();
        $type = $this->roomType('deluxe', 150);
        $this->room($type);
        $guest = $this->guest();
        Sanctum::actingAs($guest);

        $response = $this->postJson('/api/public/reservations', [
            'room_type_id' => $type->id,
            'check_in' => '2026-10-12',
            'check_out' => '2026-10-10',
            'adults' => 2,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors('check_out');
    }

    public function test_public_reservation_invalid_room_type(): void
    {
        $this->setupSettings();
        $guest = $this->guest();
        Sanctum::actingAs($guest);

        $response = $this->postJson('/api/public/reservations', [
            'room_type_id' => 9999,
            'check_in' => '2026-10-10',
            'check_out' => '2026-10-12',
            'adults' => 2,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors('room_type_id');
    }

    public function test_public_reservation_no_available_rooms(): void
    {
        $this->setupSettings();
        $type = $this->roomType('deluxe', 150);
        $room = $this->room($type);

        Reservation::create([
            'reservation_number' => 'BK-' . now()->year . '-0050',
            'guest_id' => $this->guest()->id,
            'room_id' => $room->id,
            'status' => 'confirmed',
            'check_in' => '2026-10-10',
            'check_out' => '2026-10-12',
            'adults' => 2,
            'price_per_night' => 150,
            'total_nights' => 2,
            'subtotal' => 300,
            'tax_amount' => 30,
            'total_amount' => 330,
            'due_amount' => 330,
            'payment_status' => 'unpaid',
            'source' => 'booking_engine',
        ]);

        $guest = $this->guest(['email' => 'booker@example.com']);
        Sanctum::actingAs($guest);

        $response = $this->postJson('/api/public/reservations', [
            'room_type_id' => $type->id,
            'check_in' => '2026-10-10',
            'check_out' => '2026-10-12',
            'adults' => 2,
        ]);

        $response->assertStatus(422);
    }

    public function test_public_reservation_respects_max_advance_days(): void
    {
        Setting::create(['key' => 'max_advance_days', 'value' => '30', 'group' => 'booking']);
        $type = $this->roomType('deluxe', 150);
        $this->room($type);
        $guest = $this->guest();
        Sanctum::actingAs($guest);

        $farFuture = now()->addDays(35)->format('Y-m-d');
        $response = $this->postJson('/api/public/reservations', [
            'room_type_id' => $type->id,
            'check_in' => $farFuture,
            'check_out' => now()->addDays(37)->format('Y-m-d'),
            'adults' => 1,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors('check_in');
    }

    public function test_public_reservation_max_advance_zero_unlimited(): void
    {
        $this->setupSettings();
        Setting::where('key', 'max_advance_days')->update(['value' => '0']);

        $type = $this->roomType('deluxe', 150);
        $this->room($type);
        $guest = $this->guest();
        Sanctum::actingAs($guest);

        $farFuture = now()->addDays(365)->format('Y-m-d');
        $response = $this->postJson('/api/public/reservations', [
            'room_type_id' => $type->id,
            'check_in' => $farFuture,
            'check_out' => now()->addDays(366)->format('Y-m-d'),
            'adults' => 1,
        ]);

        $response->assertStatus(201);
    }

    public function test_public_reservation_rejects_children_over_max(): void
    {
        $this->setupSettings();
        $type = $this->roomType('deluxe', 150);
        $this->room($type);
        $guest = $this->guest();
        Sanctum::actingAs($guest);

        $checkIn = now()->addDays(10)->format('Y-m-d');
        $response = $this->postJson('/api/public/reservations', [
            'room_type_id' => $type->id,
            'check_in' => $checkIn,
            'check_out' => now()->addDays(12)->format('Y-m-d'),
            'adults' => 1,
            'children' => 2,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors('children');

        $this->assertDatabaseMissing('reservations', [
            'room_type_id' => $type->id,
        ]);
    }

    public function test_public_reservation_rejects_past_check_in_date(): void
    {
        $this->setupSettings();
        $type = $this->roomType('deluxe', 150);
        $this->room($type);
        $guest = $this->guest();
        Sanctum::actingAs($guest);

        $response = $this->postJson('/api/public/reservations', [
            'room_type_id' => $type->id,
            'check_in' => now()->subDays(2)->format('Y-m-d'),
            'check_out' => now()->addDays(2)->format('Y-m-d'),
            'adults' => 1,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors('check_in');
    }

    public function test_public_reservation_accepts_check_in_today(): void
    {
        $this->setupSettings();
        $type = $this->roomType('deluxe', 150);
        $this->room($type);
        $guest = $this->guest();
        Sanctum::actingAs($guest);

        $response = $this->postJson('/api/public/reservations', [
            'room_type_id' => $type->id,
            'check_in' => now()->format('Y-m-d'),
            'check_out' => now()->addDays(1)->format('Y-m-d'),
            'adults' => 1,
        ]);

        $response->assertStatus(201);
    }

    public function test_public_reservation_assigns_first_available_room(): void
    {
        $this->setupSettings();
        $type = $this->roomType('deluxe', 150);
        $room1 = $this->room($type, ['room_number' => '201']);
        $room2 = $this->room($type, ['room_number' => '101']);

        $checkIn = now()->addDays(10)->format('Y-m-d');
        $checkOut = now()->addDays(12)->format('Y-m-d');

        Reservation::create([
            'reservation_number' => 'BK-' . now()->year . '-0060',
            'guest_id' => $this->guest()->id,
            'room_id' => $room2->id,
            'status' => 'confirmed',
            'check_in' => $checkIn,
            'check_out' => $checkOut,
            'adults' => 2,
            'price_per_night' => 150,
            'total_nights' => 2,
            'subtotal' => 300,
            'tax_amount' => 30,
            'total_amount' => 330,
            'due_amount' => 330,
            'payment_status' => 'unpaid',
            'source' => 'booking_engine',
        ]);

        $guest = $this->guest(['email' => 'assigner@example.com']);
        Sanctum::actingAs($guest);

        $response = $this->postJson('/api/public/reservations', [
            'room_type_id' => $type->id,
            'check_in' => $checkIn,
            'check_out' => $checkOut,
            'adults' => 2,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('room.id', $room1->id);
    }

    public function test_public_reservation_generates_number(): void
    {
        $this->setupSettings();
        $type = $this->roomType('deluxe', 150);
        $this->room($type);
        $guest = $this->guest();
        Sanctum::actingAs($guest);

        $checkIn = now()->addDays(10)->format('Y-m-d');
        $checkOut = now()->addDays(12)->format('Y-m-d');

        $response = $this->postJson('/api/public/reservations', [
            'room_type_id' => $type->id,
            'check_in' => $checkIn,
            'check_out' => $checkOut,
            'adults' => 2,
        ]);

        $response->assertStatus(201);
        $number = $response->json('reservation_number');
        $this->assertStringStartsWith('BK-' . now()->year . '-', $number);
    }

    public function test_public_reservation_tax_from_settings(): void
    {
        Setting::create(['key' => 'tax_rate', 'value' => '5', 'group' => 'tax']);
        $type = $this->roomType('deluxe', 200);
        $this->room($type);
        $guest = $this->guest();
        Sanctum::actingAs($guest);

        $checkIn = now()->addDays(10)->format('Y-m-d');
        $checkOut = now()->addDays(12)->format('Y-m-d');

        $response = $this->postJson('/api/public/reservations', [
            'room_type_id' => $type->id,
            'check_in' => $checkIn,
            'check_out' => $checkOut,
            'adults' => 2,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('tax_amount', '20.00')
            ->assertJsonPath('total_amount', '420.00');
    }

    public function test_public_reservation_logs_activity(): void
    {
        $this->setupSettings();
        $type = $this->roomType('deluxe', 150);
        $this->room($type);
        $guest = $this->guest();
        Sanctum::actingAs($guest);

        $checkIn = now()->addDays(10)->format('Y-m-d');
        $checkOut = now()->addDays(12)->format('Y-m-d');

        $this->postJson('/api/public/reservations', [
            'room_type_id' => $type->id,
            'check_in' => $checkIn,
            'check_out' => $checkOut,
            'adults' => 2,
        ]);

        $this->assertDatabaseHas('activity_logs', [
            'action' => 'created',
            'module' => 'reservations',
            'model_type' => 'Reservation',
        ]);
    }

    // =========================================================================
    // RESERVATIONS: LIST
    // =========================================================================

    public function test_public_reservations_list_own_only(): void
    {
        $guest1 = $this->guest(['email' => 'g1@example.com']);
        $guest2 = $this->guest(['email' => 'g2@example.com']);
        $type = $this->roomType('deluxe', 150);
        $room = $this->room($type);

        Reservation::create([
            'reservation_number' => 'BK-' . now()->year . '-0070',
            'guest_id' => $guest1->id,
            'room_id' => $room->id,
            'status' => 'confirmed',
            'check_in' => '2026-09-10',
            'check_out' => '2026-09-12',
            'adults' => 2,
            'price_per_night' => 150,
            'total_nights' => 2,
            'subtotal' => 300,
            'tax_amount' => 30,
            'total_amount' => 330,
            'due_amount' => 330,
            'payment_status' => 'unpaid',
            'source' => 'booking_engine',
        ]);
        Reservation::create([
            'reservation_number' => 'BK-' . now()->year . '-0071',
            'guest_id' => $guest2->id,
            'room_id' => $room->id,
            'status' => 'confirmed',
            'check_in' => '2026-10-10',
            'check_out' => '2026-10-12',
            'adults' => 2,
            'price_per_night' => 150,
            'total_nights' => 2,
            'subtotal' => 300,
            'tax_amount' => 30,
            'total_amount' => 330,
            'due_amount' => 330,
            'payment_status' => 'unpaid',
            'source' => 'booking_engine',
        ]);

        Sanctum::actingAs($guest1);

        $response = $this->getJson('/api/public/reservations');

        $response->assertStatus(200);
        $this->assertCount(1, $response->json('data'));
        $this->assertEquals($guest1->id, $response->json('data.0.guest_id'));
    }

    public function test_public_reservations_list_pagination(): void
    {
        $guest = $this->guest();
        $type = $this->roomType('deluxe', 150);
        $room = $this->room($type);

        for ($i = 0; $i < 15; $i++) {
            Reservation::create([
                'reservation_number' => 'BK-' . now()->year . '-01' . str_pad($i, 2, '0', STR_PAD_LEFT),
                'guest_id' => $guest->id,
                'room_id' => $room->id,
                'status' => 'confirmed',
                'check_in' => now()->addDays(10 + $i)->format('Y-m-d'),
                'check_out' => now()->addDays(12 + $i)->format('Y-m-d'),
                'adults' => 2,
                'price_per_night' => 150,
                'total_nights' => 2,
                'subtotal' => 300,
                'tax_amount' => 30,
                'total_amount' => 330,
                'due_amount' => 330,
                'payment_status' => 'unpaid',
                'source' => 'booking_engine',
            ]);
        }

        Sanctum::actingAs($guest);

        $response = $this->getJson('/api/public/reservations?per_page=10');

        $response->assertStatus(200)
            ->assertJsonPath('total', 15)
            ->assertJsonPath('per_page', 10)
            ->assertJsonCount(10, 'data');
    }

    public function test_public_reservations_list_requires_auth(): void
    {
        $this->getJson('/api/public/reservations')->assertStatus(401);
    }

    // =========================================================================
    // RESERVATIONS: SHOW
    // =========================================================================

    public function test_public_reservation_show(): void
    {
        $reservation = $this->makeReservation();
        Sanctum::actingAs($reservation->guest);

        $response = $this->getJson("/api/public/reservations/{$reservation->id}");

        $response->assertStatus(200)
            ->assertJsonPath('id', $reservation->id)
            ->assertJsonPath('reservation_number', $reservation->reservation_number)
            ->assertJsonStructure(['id', 'reservation_number', 'room', 'payments']);

        $this->assertArrayHasKey('room_type', $response->json('room'));
        $this->assertArrayHasKey('id', $response->json('room'));
    }

    public function test_public_reservation_show_other_guest_404(): void
    {
        $reservation = $this->makeReservation();
        $otherGuest = $this->guest(['email' => 'other@example.com']);
        Sanctum::actingAs($otherGuest);

        $this->getJson("/api/public/reservations/{$reservation->id}")
            ->assertStatus(404)
            ->assertJsonPath('message', 'Not found.');
    }

    // =========================================================================
    // RESERVATIONS: CANCEL
    // =========================================================================

    public function test_public_reservation_cancel_success(): void
    {
        $reservation = $this->makeReservation();
        $room = $reservation->room;
        Sanctum::actingAs($reservation->guest);

        $response = $this->postJson("/api/public/reservations/{$reservation->id}/cancel");

        $response->assertStatus(200)
            ->assertJsonPath('status', 'cancelled');

        $this->assertDatabaseHas('rooms', ['id' => $room->id, 'status' => 'available']);
        $this->assertDatabaseHas('reservations', ['id' => $reservation->id, 'status' => 'cancelled']);
    }

    public function test_public_reservation_cancel_already_cancelled(): void
    {
        $reservation = $this->makeReservation(['status' => 'cancelled']);
        Sanctum::actingAs($reservation->guest);

        $response = $this->postJson("/api/public/reservations/{$reservation->id}/cancel");

        $response->assertStatus(422)
            ->assertJsonPath('message', 'Reservation cannot be cancelled.');
    }

    public function test_public_reservation_cancel_checked_out(): void
    {
        $reservation = $this->makeReservation(['status' => 'checked_out']);
        Sanctum::actingAs($reservation->guest);

        $response = $this->postJson("/api/public/reservations/{$reservation->id}/cancel");

        $response->assertStatus(422)
            ->assertJsonPath('message', 'Reservation cannot be cancelled.');
    }

    public function test_public_reservation_cancel_other_guest_404(): void
    {
        $reservation = $this->makeReservation();
        $otherGuest = $this->guest(['email' => 'other@example.com']);
        Sanctum::actingAs($otherGuest);

        $this->postJson("/api/public/reservations/{$reservation->id}/cancel")
            ->assertStatus(404);
    }

    public function test_public_reservation_cancel_logs_activity(): void
    {
        $reservation = $this->makeReservation();
        Sanctum::actingAs($reservation->guest);

        $this->postJson("/api/public/reservations/{$reservation->id}/cancel");

        $this->assertDatabaseHas('activity_logs', [
            'action' => 'cancelled',
            'module' => 'reservations',
            'model_id' => $reservation->id,
        ]);
    }

    // =========================================================================
    // PAYMENTS (self-pay endpoint removed - guests pay via online gateway only)
    // =========================================================================
    public function test_public_payment_self_pay_endpoint_removed(): void
    {
        $guest = $this->guest();
        Sanctum::actingAs($guest);

        $response = $this->postJson("/api/public/payments", [
            "reservation_id" => 1,
            "amount" => 100,
            "payment_method" => "gcash",
        ]);

        $response->assertStatus(404);
        $this->assertDatabaseCount("payments", 0);
    }

    // =========================================================================
    // CONTACT
    // =========================================================================

    public function test_public_contact_submit_success(): void
    {
        $response = $this->postJson('/api/public/contact', [
            'name' => 'Jane Doe',
            'email' => 'jane@example.com',
            'subject' => 'Booking inquiry',
            'message' => 'Do you have rooms available for next week?',
            'website' => '',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('message', 'Message sent successfully.');

        $this->assertDatabaseHas('contact_messages', [
            'name' => 'Jane Doe',
            'email' => 'jane@example.com',
            'subject' => 'Booking inquiry',
        ]);
    }

    public function test_public_contact_honeypot_drops_message(): void
    {
        $response = $this->postJson('/api/public/contact', [
            'name' => 'Bot',
            'email' => 'bot@example.com',
            'subject' => 'spam',
            'message' => 'Buy viagra now',
            'website' => 'http://spam.com',
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseMissing('contact_messages', [
            'email' => 'bot@example.com',
        ]);
        $this->assertDatabaseCount('contact_messages', 0);
    }

    public function test_public_contact_validation_errors(): void
    {
        $response = $this->postJson('/api/public/contact', [
            'name' => '',
            'email' => 'not-email',
            'subject' => '',
            'message' => '',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['name', 'email', 'subject', 'message']);
    }

    public function test_public_contact_records_ip(): void
    {
        $this->postJson('/api/public/contact', [
            'name' => 'IP Tester',
            'email' => 'ip@example.com',
            'subject' => 'Test',
            'message' => 'Hello',
            'website' => '',
        ]);

        $this->assertDatabaseHas('contact_messages', [
            'email' => 'ip@example.com',
            'ip_address' => '127.0.0.1',
        ]);
    }

    public function test_public_contact_rate_limiting(): void
    {
        for ($i = 0; $i < 3; $i++) {
            $this->postJson('/api/public/contact', [
                'name' => "User {$i}",
                'email' => "user{$i}@example.com",
                'subject' => 'Message',
                'message' => 'Body',
                'website' => '',
            ])->assertStatus(201);
        }

        $response = $this->postJson('/api/public/contact', [
            'name' => 'Fourth',
            'email' => 'fourth@example.com',
            'subject' => 'Spam',
            'message' => 'Too many',
            'website' => '',
        ]);

        $response->assertStatus(429);
    }

    // =========================================================================
    // SETTINGS (PUBLIC)
    // =========================================================================

    public function test_public_settings_by_group(): void
    {
        Setting::create(['key' => 'hotel_name', 'value' => 'My Hotel', 'group' => 'hotel']);
        Setting::create(['key' => 'hotel_address', 'value' => '123 Main St', 'group' => 'hotel']);
        Setting::create(['key' => 'tax_rate', 'value' => '12', 'group' => 'tax']);

        $response = $this->getJson('/api/public/settings/hotel');

        $response->assertStatus(200)
            ->assertJsonPath('hotel_name', 'My Hotel')
            ->assertJsonPath('hotel_address', '123 Main St');
    }

    public function test_public_settings_empty_group(): void
    {
        $response = $this->getJson('/api/public/settings/tax');

        $response->assertStatus(200)
            ->assertJsonCount(0);
    }

    public function test_public_settings_no_auth_required(): void
    {
        Setting::create(['key' => 'hotel_name', 'value' => 'Public Hotel', 'group' => 'hotel']);

        $this->getJson('/api/public/settings/hotel')
            ->assertStatus(200)
            ->assertJsonPath('hotel_name', 'Public Hotel');
    }

    // =========================================================================
    // RBAC / ISOLATION
    // =========================================================================

    public function test_public_staff_user_cannot_access_guest_routes(): void
    {
        $role = Role::create(['name' => 'Staff', 'slug' => 'staff']);
        $user = User::create([
            'name' => 'Staff User',
            'email' => 'staff@example.com',
            'password' => Hash::make('password'),
            'role_id' => $role->id,
        ]);

        Sanctum::actingAs($user);

        $this->getJson('/api/public/me')->assertStatus(403);
        $this->getJson('/api/public/reservations')->assertStatus(403);
    }

    public function test_guest_password_update_logs_activity(): void
    {
        $guest = $this->guest(['password' => Hash::make('oldpass123')]);
        Sanctum::actingAs($guest);

        $this->putJson('/api/public/password', [
            'current_password' => 'oldpass123',
            'password' => 'newpass123',
            'password_confirmation' => 'newpass123',
        ]);

        $this->assertDatabaseHas('activity_logs', [
            'action' => 'updated',
            'module' => 'auth',
            'model_type' => 'Guest',
        ]);
    }

    public function test_guest_can_login_after_password_change(): void
    {
        $guest = $this->guest(['password' => Hash::make('oldpass123')]);

        $this->postJson('/api/public/login', [
            'email' => $guest->email,
            'password' => 'oldpass123',
        ])->assertStatus(200);

        Sanctum::actingAs($guest);
        $this->putJson('/api/public/password', [
            'current_password' => 'oldpass123',
            'password' => 'newpass456',
            'password_confirmation' => 'newpass456',
        ])->assertStatus(200);

        $this->postJson('/api/public/login', [
            'email' => $guest->email,
            'password' => 'newpass456',
        ])->assertStatus(200);
    }

    public function test_public_reservation_create_does_not_set_room_status_if_no_room(): void
    {
        $this->setupSettings();
        $inactiveType = RoomType::create([
            'name' => 'No Rooms',
            'slug' => 'no-rooms-' . uniqid(),
            'base_price' => 100,
            'is_active' => true,
            'sort_order' => 1,
        ]);

        $guest = $this->guest();
        Sanctum::actingAs($guest);

        $checkIn = now()->addDays(10)->format('Y-m-d');
        $checkOut = now()->addDays(12)->format('Y-m-d');

        $response = $this->postJson('/api/public/reservations', [
            'room_type_id' => $inactiveType->id,
            'check_in' => $checkIn,
            'check_out' => $checkOut,
            'adults' => 2,
        ]);

        $response->assertStatus(422);
    }

    public function test_public_reservation_cancel_frees_room_for_rebooking(): void
    {
        $reservation = $this->makeReservation();
        $room = $reservation->room;
        Sanctum::actingAs($reservation->guest);

        $this->postJson("/api/public/reservations/{$reservation->id}/cancel")->assertStatus(200);

        $this->assertEquals('available', $room->fresh()->status);

        $type = $room->roomType;
        $this->setupSettings();

        $response = $this->postJson('/api/public/reservations', [
            'room_type_id' => $type->id,
            'check_in' => $reservation->check_in->toDateString(),
            'check_out' => $reservation->check_out->toDateString(),
            'adults' => 2,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('room.id', $room->id);
    }
}
