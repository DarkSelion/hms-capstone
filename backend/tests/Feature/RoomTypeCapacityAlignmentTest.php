<?php

namespace Tests\Feature;

use App\Models\Guest;
use App\Models\RoomType;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RoomTypeCapacityAlignmentTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        \App\Models\Setting::create(['key' => 'tax_rate', 'value' => '10', 'group' => 'tax']);
        \App\Models\Setting::create(['key' => 'max_advance_days', 'value' => '30', 'group' => 'booking']);
    }

    private function roomType(array $overrides = []): RoomType
    {
        return RoomType::create(array_merge([
            'name' => 'Deluxe',
            'slug' => 'deluxe-' . uniqid(),
            'description' => 'A nice room',
            'base_price' => 150,
            'capacity' => 2,
            'max_adults' => 2,
            'max_children' => 1,
            'is_active' => true,
            'sort_order' => 1,
        ], $overrides));
    }

    private function room(RoomType $type, array $overrides = []): \App\Models\Room
    {
        return \App\Models\Room::create(array_merge([
            'room_number' => uniqid('R'),
            'room_type_id' => $type->id,
            'floor' => 1,
            'status' => 'available',
            'cleaning_status' => 'clean',
            'capacity' => 2,
            'is_active' => true,
        ], $overrides));
    }

    private function guest(): Guest
    {
        return Guest::create([
            'first_name' => 'Family',
            'last_name' => 'Tester',
            'email' => 'family-' . uniqid() . '@example.com',
            'phone' => '09170000000',
            'password' => Hash::make('password'),
        ]);
    }

    public function test_family_room_with_four_adults_books_successfully(): void
    {
        Sanctum::actingAs($this->guest());

        $type = $this->roomType([
            'name' => 'Family Room',
            'slug' => 'family-room-' . uniqid(),
            'capacity' => 4,
            'max_adults' => 4,
            'max_children' => 2,
            'base_price' => 200,
        ]);
        $this->room($type, ['capacity' => 4]);

        $res = $this->postJson('/api/public/reservations', [
            'room_type_id' => $type->id,
            'check_in' => now()->addDays(5)->format('Y-m-d'),
            'check_out' => now()->addDays(7)->format('Y-m-d'),
            'adults' => 4,
            'children' => 0,
        ]);

        $res->assertStatus(201);
        $reservation = \App\Models\Reservation::first();
        $this->assertNotNull($reservation);
        $this->assertSame(4, (int) $reservation->adults);
    }

    public function test_family_room_adults_above_max_adults_is_rejected(): void
    {
        Sanctum::actingAs($this->guest());

        $type = $this->roomType([
            'name' => 'Family Room',
            'slug' => 'family-room-' . uniqid(),
            'capacity' => 4,
            'max_adults' => 4,
            'max_children' => 2,
        ]);
        $this->room($type, ['capacity' => 4]);

        $res = $this->postJson('/api/public/reservations', [
            'room_type_id' => $type->id,
            'check_in' => now()->addDays(5)->format('Y-m-d'),
            'check_out' => now()->addDays(7)->format('Y-m-d'),
            'adults' => 5,
            'children' => 0,
        ]);

        $res->assertStatus(422);
        $res->assertJsonValidationErrors(['adults']);
        $this->assertSame(0, \App\Models\Reservation::count());
    }

    public function test_family_room_two_adults_two_children_books_within_capacity(): void
    {
        Sanctum::actingAs($this->guest());

        $type = $this->roomType([
            'name' => 'Family Room',
            'slug' => 'family-room-' . uniqid(),
            'capacity' => 4,
            'max_adults' => 4,
            'max_children' => 2,
        ]);
        $this->room($type, ['capacity' => 4]);

        $res = $this->postJson('/api/public/reservations', [
            'room_type_id' => $type->id,
            'check_in' => now()->addDays(5)->format('Y-m-d'),
            'check_out' => now()->addDays(7)->format('Y-m-d'),
            'adults' => 2,
            'children' => 2,
        ]);

        $res->assertStatus(201);
        $reservation = \App\Models\Reservation::first();
        $this->assertNotNull($reservation);
        $this->assertSame(2, (int) $reservation->adults);
        $this->assertSame(2, (int) $reservation->children);
    }

    public function test_total_guests_exceeding_room_capacity_is_still_rejected(): void
    {
        Sanctum::actingAs($this->guest());

        $type = $this->roomType([
            'name' => 'Family Room',
            'slug' => 'family-room-' . uniqid(),
            'capacity' => 4,
            'max_adults' => 4,
            'max_children' => 2,
        ]);
        $this->room($type, ['capacity' => 3]);

        $res = $this->postJson('/api/public/reservations', [
            'room_type_id' => $type->id,
            'check_in' => now()->addDays(5)->format('Y-m-d'),
            'check_out' => now()->addDays(7)->format('Y-m-d'),
            'adults' => 3,
            'children' => 1,
        ]);

        $res->assertStatus(422);
        $res->assertJsonValidationErrors(['adults']);
        $this->assertStringContainsString('capacity of 3', $res->json('errors.adults.0'));
        $this->assertSame(0, \App\Models\Reservation::count());
    }

    public function test_seeded_room_type_max_adults_never_exceeds_capacity(): void
    {
        $this->seed(\Database\Seeders\RoomTypeSeeder::class);

        $count = 0;
        foreach (RoomType::all() as $type) {
            $count++;
            $this->assertSame(
                (int) $type->capacity,
                (int) $type->max_adults,
                "Room type '{$type->name}' (slug: {$type->slug}) has max_adults ({$type->max_adults}) != capacity ({$type->capacity}). The max_adults gate blocks adult-only bookings that should fit the room — e.g. a 4-person family room with max_adults=2 cannot host 4 adults."
            );
        }
        $this->assertGreaterThan(0, $count, 'Seeder should produce at least one room type.');
    }
}
