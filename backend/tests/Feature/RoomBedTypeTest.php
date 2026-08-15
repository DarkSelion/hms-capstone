<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\Room;
use App\Models\RoomType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RoomBedTypeTest extends TestCase
{
    use RefreshDatabase;

    protected static int $roomCounter = 0;

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

    protected function roomType(string $slug = 'deluxe', ?string $bedType = 'King'): RoomType
    {
        return RoomType::create([
            'name' => 'Deluxe',
            'slug' => $slug,
            'base_price' => 1000,
            'bed_type' => $bedType,
        ]);
    }

    protected function room(?RoomType $type = null, array $overrides = []): Room
    {
        $type = $type ?? $this->roomType('room-type-' . (++self::$roomCounter));

        return Room::create(array_merge([
            'room_number' => '30' . self::$roomCounter,
            'room_type_id' => $type->id,
            'floor' => 3,
            'status' => 'available',
            'capacity' => 2,
            'is_active' => true,
        ], $overrides));
    }

    public function test_room_update_persists_and_returns_bed_type(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $room = $this->room();

        $response = $this->putJson("/api/rooms/{$room->id}", [
            'room_number' => $room->room_number,
            'room_type_id' => $room->room_type_id,
            'floor' => $room->floor,
            'bed_type' => 'Queen',
        ])->assertOk();

        $this->assertSame('Queen', $response->json('bed_type'));
        $this->assertDatabaseHas('rooms', ['id' => $room->id, 'bed_type' => 'Queen']);
    }

    public function test_room_update_with_empty_bed_type_clears_it(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $room = $this->room(null, ['bed_type' => 'Twin']);

        $this->putJson("/api/rooms/{$room->id}", [
            'room_number' => $room->room_number,
            'room_type_id' => $room->room_type_id,
            'floor' => $room->floor,
            'bed_type' => '',
        ])->assertOk()->assertJsonPath('bed_type', null);

        $this->assertDatabaseHas('rooms', ['id' => $room->id, 'bed_type' => null]);
    }

    public function test_room_update_allows_null_bed_type(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $room = $this->room();

        $this->putJson("/api/rooms/{$room->id}", [
            'room_number' => $room->room_number,
            'room_type_id' => $room->room_type_id,
            'floor' => $room->floor,
            'bed_type' => null,
        ])->assertOk()->assertJsonPath('bed_type', null);
    }

    public function test_room_update_rejects_overlong_bed_type(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $room = $this->room();

        $this->putJson("/api/rooms/{$room->id}", [
            'room_number' => $room->room_number,
            'room_type_id' => $room->room_type_id,
            'floor' => $room->floor,
            'bed_type' => str_repeat('x', 51),
        ])->assertStatus(422);
    }

    public function test_room_index_returns_bed_type_field(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $room = $this->room(null, ['bed_type' => 'Queen']);

        $this->getJson('/api/rooms?all=1')
            ->assertOk()
            ->assertJsonPath("data.0.id", $room->id)
            ->assertJsonPath("data.0.bed_type", 'Queen');
    }

    public function test_non_admin_cannot_update_bed_type(): void
    {
        $staffRole = Role::create(['name' => 'Staff', 'slug' => 'staff']);
        $staff = User::create([
            'name' => 'Staff User',
            'email' => 'staff@test.com',
            'password' => Hash::make('password'),
            'role_id' => $staffRole->id,
            'is_active' => true,
        ]);
        Sanctum::actingAs($staff);

        $room = $this->room();

        $this->putJson("/api/rooms/{$room->id}", [
            'room_number' => $room->room_number,
            'room_type_id' => $room->room_type_id,
            'floor' => $room->floor,
            'bed_type' => 'Queen',
        ])->assertStatus(403);

        $this->assertDatabaseHas('rooms', ['id' => $room->id, 'bed_type' => null]);
    }
}