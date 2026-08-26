<?php

namespace Database\Seeders;

use App\Models\RoomType;
use Illuminate\Database\Seeder;

class RoomTypeSeeder extends Seeder
{
    public function run(): void
    {
        $roomTypes = [
            ['name' => 'Standard Room', 'slug' => 'standard-room', 'description' => 'Comfortable standard room with essential amenities', 'base_price' => 150, 'capacity' => 2, 'size_sqm' => 28, 'bed_type' => 'Queen', 'max_adults' => 2, 'max_children' => 1, 'is_active' => true, 'sort_order' => 1],
            ['name' => 'Deluxe Room', 'slug' => 'deluxe-room', 'description' => 'Spacious deluxe room with premium furnishings', 'base_price' => 250, 'capacity' => 3, 'size_sqm' => 38, 'bed_type' => 'King', 'max_adults' => 3, 'max_children' => 2, 'is_active' => true, 'sort_order' => 2],
            ['name' => 'Junior Suite', 'slug' => 'junior-suite', 'description' => 'Elegant junior suite with separate sitting area', 'base_price' => 350, 'capacity' => 3, 'size_sqm' => 50, 'bed_type' => 'King', 'max_adults' => 3, 'max_children' => 2, 'is_active' => true, 'sort_order' => 3],
            ['name' => 'Executive Suite', 'slug' => 'executive-suite', 'description' => 'Luxurious executive suite with workspace and lounge', 'base_price' => 500, 'capacity' => 4, 'size_sqm' => 75, 'bed_type' => 'King', 'max_adults' => 4, 'max_children' => 3, 'is_active' => true, 'sort_order' => 4],
            ['name' => 'Family Room', 'slug' => 'family-room', 'description' => 'Spacious family room with Queen and Twin beds', 'base_price' => 200, 'capacity' => 4, 'size_sqm' => 45, 'bed_type' => 'Queen + Twin', 'max_adults' => 2, 'max_children' => 2, 'is_active' => true, 'sort_order' => 6],
        ];

        foreach ($roomTypes as $roomType) {
            RoomType::create($roomType);
        }
    }
}
