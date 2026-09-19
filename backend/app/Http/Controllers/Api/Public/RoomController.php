<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Models\Reservation;
use App\Models\RoomType;
use App\Models\Room;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class RoomController extends Controller
{
    private function resolveImageUrl($image): ?string
    {
        if (!$image) return null;
        return str_starts_with($image->image_path, 'http')
            ? $image->image_path
            : Storage::url($image->image_path);
    }

    public function index(Request $request)
    {
        $query = RoomType::where('is_active', true);

        if ($request->filled(['check_in', 'check_out'])) {
            $bookedRoomIds = Reservation::overlapping($request->check_in, $request->check_out)->pluck('room_id');

            $query->whereHas('rooms', function ($q) use ($bookedRoomIds) {
                $q->where('status', 'available')
                    ->where('is_active', true)
                    ->whereNotIn('id', $bookedRoomIds);
            });
        } else {
            $query->whereHas('rooms', function ($q) {
                $q->where('status', 'available')->where('is_active', true);
            });
        }

        $roomTypes = $query->withCount(['rooms' => function ($q) {
            $q->where('status', 'available')->where('is_active', true);
        }])->with(['rooms' => fn($q) => $q->where('is_active', true)->with('images')->limit(1), 'typeImages'])
            ->orderBy('sort_order')->get();

        $roomTypes->each(function ($roomType) {
            $firstRoom = $roomType->rooms->first();
            $image = $firstRoom?->images->firstWhere('is_primary', true) ?? $firstRoom?->images->first();
            $url = $this->resolveImageUrl($image);

            if (!$url && $roomType->typeImages->count() > 0) {
                $typeImage = $roomType->typeImages->firstWhere('is_primary', true) ?? $roomType->typeImages->first();
                $url = $this->resolveImageUrl($typeImage);
            }

            $roomType->setAttribute('image_url', $url);
            unset($roomType->rooms);
        });

        return response()->json($roomTypes);
    }

    public function show(string $slug)
    {
        $roomType = RoomType::where('slug', $slug)
            ->where('is_active', true)
            ->withCount(['rooms' => function ($q) {
                $q->where('status', 'available')->where('is_active', true);
            }])
            ->with(['rooms' => function ($q) {
                $q->where('status', 'available')->where('is_active', true)->with('images');
            }, 'typeImages'])
            ->firstOrFail();

        $firstRoom = $roomType->rooms->first();
        $image = $firstRoom?->images->firstWhere('is_primary', true) ?? $firstRoom?->images->first();
        $roomType->setAttribute('image_url', $this->resolveImageUrl($image));

        $gallery = [];
        if ($roomType->typeImages->count() > 0) {
            foreach ($roomType->typeImages->sortBy('sort_order') as $img) {
                $url = $this->resolveImageUrl($img);
                if ($url) {
                    $gallery[] = $url;
                }
            }
        } else {
            foreach ($roomType->rooms as $room) {
                foreach ($room->images as $img) {
                    $url = $this->resolveImageUrl($img);
                    if ($url && !in_array($url, $gallery, true)) {
                        $gallery[] = $url;
                    }
                }
            }
        }
        $roomType->setAttribute('gallery', $gallery);

        return response()->json($roomType);
    }

    public function available(Request $request)
    {
        $data = $request->validate([
            'check_in' => 'required|date',
            'check_out' => 'required|date|after:check_in',
            'room_type_id' => 'nullable|exists:room_types,id',
        ]);

        $query = Room::where('status', 'available')
            ->where('is_active', true)
            ->with(['roomType', 'images' => fn($q) => $q->where('is_primary', true)]);

        if ($roomTypeId = $request->room_type_id) {
            $query->where('room_type_id', $roomTypeId);
        }

        $bookedRoomIds = Reservation::overlapping($data['check_in'], $data['check_out'])->pluck('room_id');

        $rooms = $query->whereNotIn('id', $bookedRoomIds)->get();

        $rooms->each(function ($room) {
            $image = $room->images->first();
            $room->setAttribute('image_url', $this->resolveImageUrl($image));
            unset($room->images);
        });

        return response()->json($rooms);
    }
}
