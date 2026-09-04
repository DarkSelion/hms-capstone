<?php

namespace Database\Seeders;

use App\Models\Room;
use App\Models\RoomType;
use Illuminate\Database\Seeder;

class RoomSeeder extends Seeder
{
    public function run(): void
    {
        $roomTypes = RoomType::all()->keyBy('slug');

        $rooms = [
            // Floor 1: Standard Rooms with VARYING bed types, capacities, and prices
            ['room_number' => '101', 'room_type_slug' => 'standard-room', 'floor' => 1, 'status' => 'available', 'cleaning_status' => 'clean', 'capacity' => 2, 'bed_type' => 'Queen', 'price_override' => 150, 'is_active' => true],
            ['room_number' => '102', 'room_type_slug' => 'standard-room', 'floor' => 1, 'status' => 'available', 'cleaning_status' => 'clean', 'capacity' => 1, 'bed_type' => 'Single', 'price_override' => 100, 'is_active' => true],
            ['room_number' => '103', 'room_type_slug' => 'standard-room', 'floor' => 1, 'status' => 'available', 'cleaning_status' => 'clean', 'capacity' => 3, 'bed_type' => 'Queen + Single', 'price_override' => 180, 'is_active' => true],
            ['room_number' => '104', 'room_type_slug' => 'standard-room', 'floor' => 1, 'status' => 'available', 'cleaning_status' => 'clean', 'capacity' => 2, 'bed_type' => 'Twin', 'price_override' => 130, 'is_active' => true],
            ['room_number' => '105', 'room_type_slug' => 'standard-room', 'floor' => 1, 'status' => 'available', 'cleaning_status' => 'clean', 'capacity' => 2, 'bed_type' => 'Queen', 'price_override' => 150, 'is_active' => true],
            ['room_number' => '106', 'room_type_slug' => 'standard-room', 'floor' => 1, 'status' => 'available', 'cleaning_status' => 'clean', 'capacity' => 1, 'bed_type' => 'Single', 'price_override' => 95, 'is_active' => true],
            ['room_number' => '107', 'room_type_slug' => 'standard-room', 'floor' => 1, 'status' => 'available', 'cleaning_status' => 'clean', 'capacity' => 4, 'bed_type' => 'Queen + Bunk', 'price_override' => 200, 'is_active' => true],
            ['room_number' => '108', 'room_type_slug' => 'standard-room', 'floor' => 1, 'status' => 'available', 'cleaning_status' => 'clean', 'capacity' => 2, 'bed_type' => 'Queen', 'price_override' => 150, 'is_active' => true],

            // Floor 1: Family Rooms with different setups
            ['room_number' => '109', 'room_type_slug' => 'family-room', 'floor' => 1, 'status' => 'available', 'cleaning_status' => 'clean', 'capacity' => 4, 'bed_type' => 'Queen + Twin', 'price_override' => 220, 'is_active' => true],
            ['room_number' => '110', 'room_type_slug' => 'family-room', 'floor' => 1, 'status' => 'available', 'cleaning_status' => 'clean', 'capacity' => 5, 'bed_type' => 'Queen + Double', 'price_override' => 260, 'is_active' => true],

            // Floor 2: Deluxe Rooms with different views and prices
            ['room_number' => '201', 'room_type_slug' => 'deluxe-room', 'floor' => 2, 'status' => 'available', 'cleaning_status' => 'clean', 'capacity' => 3, 'bed_type' => 'King', 'price_override' => 250, 'is_active' => true],
            ['room_number' => '202', 'room_type_slug' => 'deluxe-room', 'floor' => 2, 'status' => 'available', 'cleaning_status' => 'clean', 'capacity' => 2, 'bed_type' => 'King', 'price_override' => 230, 'is_active' => true],
            ['room_number' => '203', 'room_type_slug' => 'deluxe-room', 'floor' => 2, 'status' => 'available', 'cleaning_status' => 'clean', 'capacity' => 4, 'bed_type' => 'King + Sofa', 'price_override' => 310, 'is_active' => true],
            ['room_number' => '204', 'room_type_slug' => 'deluxe-room', 'floor' => 2, 'status' => 'available', 'cleaning_status' => 'clean', 'capacity' => 3, 'bed_type' => 'King', 'price_override' => 250, 'is_active' => true],
            ['room_number' => '205', 'room_type_slug' => 'deluxe-room', 'floor' => 2, 'status' => 'available', 'cleaning_status' => 'clean', 'capacity' => 2, 'bed_type' => 'Twin', 'price_override' => 220, 'is_active' => true],
            ['room_number' => '206', 'room_type_slug' => 'deluxe-room', 'floor' => 2, 'status' => 'available', 'cleaning_status' => 'clean', 'capacity' => 4, 'bed_type' => 'King + Sofa', 'price_override' => 320, 'is_active' => true],
            ['room_number' => '207', 'room_type_slug' => 'deluxe-room', 'floor' => 2, 'status' => 'available', 'cleaning_status' => 'clean', 'capacity' => 3, 'bed_type' => 'King', 'price_override' => 260, 'is_active' => true],
            ['room_number' => '208', 'room_type_slug' => 'deluxe-room', 'floor' => 2, 'status' => 'available', 'cleaning_status' => 'clean', 'capacity' => 2, 'bed_type' => 'King', 'price_override' => 240, 'is_active' => true],

            // Floor 2-3: Junior Suites
            ['room_number' => '209', 'room_type_slug' => 'junior-suite', 'floor' => 2, 'status' => 'available', 'cleaning_status' => 'clean', 'capacity' => 3, 'bed_type' => 'King', 'price_override' => 350, 'is_active' => true],
            ['room_number' => '210', 'room_type_slug' => 'junior-suite', 'floor' => 2, 'status' => 'available', 'cleaning_status' => 'clean', 'capacity' => 4, 'bed_type' => 'King + Sofa', 'price_override' => 400, 'is_active' => true],

            // Floor 3: Junior Suites + Executive
            ['room_number' => '301', 'room_type_slug' => 'junior-suite', 'floor' => 3, 'status' => 'available', 'cleaning_status' => 'clean', 'capacity' => 3, 'bed_type' => 'King', 'price_override' => 360, 'is_active' => true],
            ['room_number' => '302', 'room_type_slug' => 'junior-suite', 'floor' => 3, 'status' => 'available', 'cleaning_status' => 'clean', 'capacity' => 4, 'bed_type' => 'King + Sofa', 'price_override' => 420, 'is_active' => true],
            ['room_number' => '303', 'room_type_slug' => 'junior-suite', 'floor' => 3, 'status' => 'available', 'cleaning_status' => 'clean', 'capacity' => 3, 'bed_type' => 'King', 'price_override' => 350, 'is_active' => true],
            ['room_number' => '304', 'room_type_slug' => 'junior-suite', 'floor' => 3, 'status' => 'available', 'cleaning_status' => 'clean', 'capacity' => 4, 'bed_type' => 'King + Sofa', 'price_override' => 410, 'is_active' => true],

            // Executive Suites
            ['room_number' => '305', 'room_type_slug' => 'executive-suite', 'floor' => 3, 'status' => 'available', 'cleaning_status' => 'clean', 'capacity' => 4, 'bed_type' => 'King', 'price_override' => 500, 'is_active' => true],
        ];

        foreach ($rooms as $roomData) {
            $slug = $roomData['room_type_slug'];
            unset($roomData['room_type_slug']);
            $roomData['room_type_id'] = $roomTypes[$slug]->id;

            Room::create($roomData);
        }
    }
}
