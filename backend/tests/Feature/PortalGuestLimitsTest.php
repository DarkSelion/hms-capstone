<?php

namespace Tests\Feature;

use App\Models\Guest;
use App\Models\RoomType;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PortalGuestLimitsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setupSettings();
    }

    private function setupSettings(): void
    {
        \App\Models\Setting::create(['key' => 'tax_rate', 'value' => '10', 'group' => 'tax']);
        \App\Models\Setting::create(['key' => 'max_advance_days', 'value' => '30', 'group' => 'booking']);
    }

    private function guest(): Guest
    {
        return Guest::create([
            'first_name' => 'Party',
            'last_name' => 'Leader',
            'email' => 'party@example.com',
            'phone' => '09170000000',
            'password' => Hash::make('password'),
        ]);
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

    public function test_adults_above_room_type_max_is_rejected(): void
    {
        Sanctum::actingAs($this->guest());
        $type = $this->roomType(['max_adults' => 2]);
        // Room capacity is generous — only the type's max_adults should block this.
        $this->room($type, ['capacity' => 4]);

        $res = $this->postJson('/api/public/reservations', $this->payload($type, ['adults' => 3]));

        $res->assertStatus(422);
        $res->assertJsonValidationErrors(['adults']);
        $this->assertStringContainsString('up to 2 adults', $res->json('errors.adults.0'));
        $this->assertSame(0, \App\Models\Reservation::count());
    }

    public function test_total_guests_over_room_capacity_is_rejected_even_if_children_fit_max(): void
    {
        Sanctum::actingAs($this->guest());
        $type = $this->roomType(['max_adults' => 3, 'max_children' => 3]);
        $this->room($type, ['capacity' => 3]);

        // 2 adults + 2 children = 4 total > capacity 3; children also fit max_children.
        $res = $this->postJson('/api/public/reservations', $this->payload($type, [
            'adults' => 2, 'children' => 2,
        ]));

        $res->assertStatus(422);
        $res->assertJsonValidationErrors(['adults']);
        $this->assertStringContainsString("capacity of 3", $res->json('errors.adults.0'));
        $this->assertSame(0, \App\Models\Reservation::count());
    }

    public function test_party_within_all_limits_is_accepted(): void
    {
        Sanctum::actingAs($this->guest());
        $type = $this->roomType(['max_adults' => 2, 'max_children' => 1]);
        $this->room($type, ['capacity' => 3]);

        $res = $this->postJson('/api/public/reservations', $this->payload($type, [
            'adults' => 2, 'children' => 1,
        ]));

        $res->assertStatus(201);
        $reservation = \App\Models\Reservation::first();
        $this->assertNotNull($reservation);
        $this->assertSame(2, (int) $reservation->adults);
        $this->assertSame(1, (int) $reservation->children);
    }
}
