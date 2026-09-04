<?php

namespace Database\Seeders;

use App\Models\Room;
use App\Models\RoomImage;
use Illuminate\Database\Seeder;

class RoomImageSeeder extends Seeder
{
    private const IMAGES = [
        'rooms' => [
            'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=900&h=550&fit=crop',
            'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=900&h=550&fit=crop',
            'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=900&h=550&fit=crop',
        ],
        'suites' => [
            'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=900&h=550&fit=crop',
            'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=900&h=550&fit=crop',
            'https://images.unsplash.com/photo-1591088398332-8a7791972843?w=900&h=550&fit=crop',
        ],
        'villas' => [
            'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=900&h=550&fit=crop',
            'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=900&h=550&fit=crop',
            'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=900&h=550&fit=crop',
        ],
    ];

    public function run(): void
    {
        $rooms = Room::with('roomType')->get();

        foreach ($rooms as $room) {
            $category = $this->resolveCategory($room->roomType->name ?? '');

            if (($room->roomType->slug ?? '') === 'deluxe-room') {
                RoomImage::create([
                    'room_id' => $room->id,
                    'image_path' => 'rooms/deluxe-room.jpg',
                    'caption' => ($room->roomType->name ?? '') . ' - ' . $room->room_number,
                    'sort_order' => 0,
                    'is_primary' => true,
                ]);
                continue;
            }

            $urls = self::IMAGES[$category];

            RoomImage::create([
                'room_id' => $room->id,
                'image_path' => $urls[0],
                'caption' => ($room->roomType->name ?? '') . ' - ' . $room->room_number,
                'sort_order' => 0,
                'is_primary' => true,
            ]);
        }
    }

    private function resolveCategory(string $name): string
    {
        $lower = strtolower($name);
        if (str_contains($lower, 'villa')) return 'villas';
        if (str_contains($lower, 'suite')) return 'suites';
        return 'rooms';
    }
}
