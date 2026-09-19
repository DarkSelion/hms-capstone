<?php

namespace Database\Seeders;

use App\Models\Room;
use App\Models\RoomImage;
use Illuminate\Database\Seeder;

class RoomImageSeeder extends Seeder
{
    private const IMAGES = [
        'standard' => [
            'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=900&h=550&fit=crop',
            'https://images.unsplash.com/photo-1590490360182-c33d7e6db52e?w=900&h=550&fit=crop',
            'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=900&h=550&fit=crop',
            'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=900&h=550&fit=crop',
        ],
        'deluxe' => [
            'https://images.unsplash.com/photo-1564078516393-cf04bd966897?w=900&h=550&fit=crop',
            'https://images.unsplash.com/photo-1590490360182-c33d7e6db52e?w=900&h=550&fit=crop',
            'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=900&h=550&fit=crop',
            'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=900&h=550&fit=crop',
        ],
        'junior_suite' => [
            'https://images.unsplash.com/photo-1617325247661-675ab4b64ae2?w=900&h=550&fit=crop',
            'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=900&h=550&fit=crop',
            'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=900&h=550&fit=crop',
            'https://images.unsplash.com/photo-1591088398332-8a7791972843?w=900&h=550&fit=crop',
        ],
        'executive_suite' => [
            'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=900&h=550&fit=crop',
            'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=900&h=550&fit=crop',
            'https://images.unsplash.com/photo-1591088398332-8a7791972843?w=900&h=550&fit=crop',
            'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=900&h=550&fit=crop',
        ],
        'family' => [
            'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=900&h=550&fit=crop',
            'https://images.unsplash.com/photo-1590490360182-c33d7e6db52e?w=900&h=550&fit=crop',
            'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=900&h=550&fit=crop',
            'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=900&h=550&fit=crop',
        ],
    ];

    public function run(): void
    {
        $rooms = Room::with('roomType')->get();

        foreach ($rooms as $room) {
            $category = $this->resolveCategory($room->roomType->slug ?? '');
            $urls = self::IMAGES[$category];

            foreach ($urls as $idx => $url) {
                RoomImage::create([
                    'room_id' => $room->id,
                    'image_path' => $url,
                    'caption' => ($room->roomType->name ?? '') . ' - ' . $room->room_number,
                    'sort_order' => $idx,
                    'is_primary' => $idx === 0,
                ]);
            }
        }
    }

    private function resolveCategory(string $slug): string
    {
        return match ($slug) {
            'deluxe-room' => 'deluxe',
            'junior-suite' => 'junior_suite',
            'executive-suite' => 'executive_suite',
            'family-room' => 'family',
            default => 'standard',
        };
    }
}
