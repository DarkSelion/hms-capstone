<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\RoomTypeImageResource;
use App\Models\RoomType;
use App\Models\RoomTypeImage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class RoomTypeImageController extends Controller
{
    public function index(RoomType $roomType)
    {
        $images = $roomType->typeImages()->orderBy('sort_order')->orderBy('created_at')->get();

        return response()->json(RoomTypeImageResource::collection($images));
    }

    public function store(Request $request, RoomType $roomType)
    {
        $request->validate([
            'image' => 'required|image|mimes:jpeg,png,jpg,webp|max:4096',
            'caption' => 'nullable|string|max:255',
            'is_primary' => 'sometimes|boolean',
        ]);

        $path = $request->file('image')->store("room-types/{$roomType->id}", 'public');

        $maxOrder = $roomType->typeImages()->max('sort_order') ?? 0;

        $image = $roomType->typeImages()->create([
            'image_path' => $path,
            'caption' => $request->caption,
            'sort_order' => $maxOrder + 1,
            'is_primary' => $request->boolean('is_primary', false),
        ]);

        if ($image->is_primary) {
            $roomType->typeImages()
                ->where('id', '!=', $image->id)
                ->update(['is_primary' => false]);
        }

        return response()->json(new RoomTypeImageResource($image), 201);
    }

    public function update(Request $request, RoomType $roomType, RoomTypeImage $typeImage)
    {
        $request->validate([
            'caption' => 'nullable|string|max:255',
            'is_primary' => 'sometimes|boolean',
            'sort_order' => 'sometimes|integer|min:0',
        ]);

        $typeImage->update($request->only(['caption', 'sort_order', 'is_primary']));

        if ($request->boolean('is_primary')) {
            $roomType->typeImages()
                ->where('id', '!=', $typeImage->id)
                ->update(['is_primary' => false]);
        }

        return response()->json(new RoomTypeImageResource($typeImage->fresh()));
    }

    public function destroy(RoomType $roomType, RoomTypeImage $typeImage)
    {
        Storage::disk('public')->delete($typeImage->image_path);

        $typeImage->delete();

        return response()->json(['message' => 'Image deleted successfully.']);
    }
}
