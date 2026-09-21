<?php

namespace Tests\Feature;

use App\Models\Guest;
use App\Models\Room;
use App\Models\RoomType;
use App\Models\Setting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RoomCapacityVariationsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Setting::create(['key' => 'tax_rate', 'value' => '10', 'group' => 'tax']);
        Setting::create(['key' => 'max_advance_days', 'value' => '30', 'group' => 'booking']);
    }

    private function roomType(array $overrides = []): RoomType
    {
        return RoomType::create(array_merge([
            'name' => 'Standard',
            'slug' => 'standard-' . uniqid(),
            'description' => 'A standard room',
            'base_price' => 150,
            'capacity' => 2,
            'max_adults' => 2,
            'max_children' => 1,
            'is_active' => true,
            'sort_order' => 1,
        ], $overrides));
    }

    private function room(RoomType $type, array $overrides = []): Room
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

    private function guest(): Guest
    {
        return Guest::create([
            'first_name' => 'Test',
            'last_name' => 'Guest',
            'email' => 'test-' . uniqid() . '@example.com',
            'phone' => '09170000000',
            'password' => Hash::make('password'),
            'email_verified_at' => now(),
        ]);
    }

    private function payload(RoomType $type, array $overrides = []): array
    {
        return array_merge([
            'room_type_id' => $type->id,
            'check_in' => now()->addDays(5)->format('Y-m-d'),
            'check_out' => now()->addDays(7)->format('Y-m-d'),
            'adults' => 1,
            'children' => 0,
        ], $overrides);
    }

    public function test_min_max_capacity_computed_from_rooms(): void
    {
        $type = $this->roomType(['capacity' => 2]);
        $this->room($type, ['capacity' => 1]);
        $this->room($type, ['capacity' => 3]);
        $this->room($type, ['capacity' => 2]);

        $res = $this->getJson("/api/public/rooms/{$type->slug}");
        $res->assertStatus(200);
        $data = $res->json();
        $this->assertSame(1, $data['min_capacity']);
        $this->assertSame(3, $data['max_capacity']);
    }

    public function test_min_max_capacity_falls_back_to_type_capacity_when_no_rooms(): void
    {
        $type = $this->roomType(['capacity' => 4]);

        $res = $this->getJson("/api/public/rooms/{$type->slug}");
        $res->assertStatus(200);
        $data = $res->json();
        $this->assertSame(4, $data['min_capacity']);
        $this->assertSame(4, $data['max_capacity']);
    }

    public function test_public_room_type_index_includes_min_max_capacity(): void
    {
        $type = $this->roomType(['capacity' => 2]);
        $this->room($type, ['capacity' => 1]);
        $this->room($type, ['capacity' => 4]);

        $res = $this->getJson('/api/public/rooms');
        $res->assertStatus(200);
        $found = collect($res->json())->firstWhere('id', $type->id);
        $this->assertNotNull($found);
        $this->assertSame(1, $found['min_capacity']);
        $this->assertSame(4, $found['max_capacity']);
    }

    public function test_booking_with_adults_above_type_max_but_within_room_capacity_succeeds(): void
    {
        Sanctum::actingAs($this->guest());

        $type = $this->roomType([
            'max_adults' => 2,
            'max_children' => 1,
            'capacity' => 2,
        ]);
        // Room 107 has capacity 4 — 3 adults fit even though type max_adults=2.
        $this->room($type, ['capacity' => 4]);

        $res = $this->postJson('/api/public/reservations', $this->payload($type, [
            'adults' => 3,
            'children' => 0,
        ]));

        $res->assertStatus(201);
        $this->assertSame(1, \App\Models\Reservation::count());
    }

    public function test_booking_with_total_guests_exceeding_room_capacity_is_rejected(): void
    {
        Sanctum::actingAs($this->guest());

        $type = $this->roomType(['capacity' => 3]);
        $this->room($type, ['capacity' => 2]);

        $res = $this->postJson('/api/public/reservations', $this->payload($type, [
            'adults' => 2,
            'children' => 1,
        ]));

        $res->assertStatus(422);
        $res->assertJsonValidationErrors(['adults']);
        $this->assertStringContainsString('capacity of 2', $res->json('errors.adults.0'));
        $this->assertSame(0, \App\Models\Reservation::count());
    }

    public function test_booking_with_children_filling_remaining_capacity_succeeds(): void
    {
        Sanctum::actingAs($this->guest());

        $type = $this->roomType(['capacity' => 3, 'max_adults' => 3, 'max_children' => 2]);
        $this->room($type, ['capacity' => 3]);

        $res = $this->postJson('/api/public/reservations', $this->payload($type, [
            'adults' => 1,
            'children' => 2,
        ]));

        $res->assertStatus(201);
        $reservation = \App\Models\Reservation::first();
        $this->assertSame(1, (int) $reservation->adults);
        $this->assertSame(2, (int) $reservation->children);
    }

    public function test_room_allocation_picks_capacity_appropriate_room(): void
    {
        Sanctum::actingAs($this->guest());

        $type = $this->roomType(['capacity' => 2]);
        $smallRoom = $this->room($type, ['capacity' => 2, 'room_number' => 'S01']);
        $largeRoom = $this->room($type, ['capacity' => 4, 'room_number' => 'L01']);

        // Booking 3 adults — only largeRoom fits.
        $res = $this->postJson('/api/public/reservations', $this->payload($type, [
            'adults' => 3,
            'children' => 0,
        ]));

        $res->assertStatus(201);
        $reservation = \App\Models\Reservation::first();
        $this->assertSame($largeRoom->id, $reservation->room_id);
    }

    public function test_public_available_rooms_filters_by_total_guests(): void
    {
        $type = $this->roomType(['capacity' => 2]);
        $this->room($type, ['capacity' => 2, 'room_number' => 'A01']);
        $this->room($type, ['capacity' => 4, 'room_number' => 'A02']);

        $checkIn = now()->addDays(5)->format('Y-m-d');
        $checkOut = now()->addDays(7)->format('Y-m-d');

        // Requesting 3 guests — only the capacity-4 room should appear.
        $res = $this->getJson("/api/public/rooms/available?check_in={$checkIn}&check_out={$checkOut}&adults=3&children=0");
        $res->assertStatus(200);
        $rooms = $res->json();
        $this->assertCount(1, $rooms);
        $this->assertSame('A02', $rooms[0]['room_number']);
    }
}
