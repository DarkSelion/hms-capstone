<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RoomType;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class RoomTypeController extends Controller
{
    public function index(Request $request)
    {
        $sortBy = in_array($request->sort_by, ['name', 'base_price', 'capacity', 'size_sqm', 'bed_type']) ? $request->sort_by : 'name';
        $sortDir = $request->sort_dir === 'desc' ? 'desc' : 'asc';

        return response()->json(
            RoomType::withCount('rooms')
                ->orderBy($sortBy, $sortDir)
                ->paginate($request->per_page ?? 10)
        );
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:100|unique:room_types,name',
            'description' => 'nullable|string',
            'base_price' => 'required|numeric|min:0',
            'capacity' => 'required|integer|min:1',
            'size_sqm' => 'nullable|numeric|min:0',
            'bed_type' => 'nullable|string|max:50',
            'amenities' => 'nullable|array',
            'is_active' => 'sometimes|boolean',
        ]);

        $roomType = RoomType::create($data + ['slug' => $this->uniqueSlug($data['name'])]);

        return response()->json($roomType, 201);
    }

    public function show(RoomType $roomType)
    {
        return response()->json($roomType->loadCount('rooms'));
    }

    public function update(Request $request, RoomType $roomType)
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:100|unique:room_types,name,' . $roomType->id,
            'description' => 'nullable|string',
            'base_price' => 'sometimes|numeric|min:0',
            'capacity' => 'sometimes|integer|min:1',
            'size_sqm' => 'nullable|numeric|min:0',
            'bed_type' => 'nullable|string|max:50',
            'amenities' => 'nullable|array',
            'is_active' => 'sometimes|boolean',
        ]);

        if (isset($data['name']) && $data['name'] !== $roomType->name) {
            $data['slug'] = $this->uniqueSlug($data['name'], $roomType->id);
        }

        $roomType->update($data);

        return response()->json($roomType);
    }

    public function destroy(RoomType $roomType)
    {
        if ($roomType->rooms()->exists()) {
            return response()->json(['message' => 'Cannot delete room type with existing rooms.'], 422);
        }

        $roomType->delete();

        return response()->json(['message' => 'Room type deleted successfully.']);
    }

    protected function uniqueSlug(string $name, ?int $ignoreId = null): string
    {
        $base = Str::slug($name) ?: 'room-type';
        $slug = $base;
        $i = 2;

        while (RoomType::where('slug', $slug)->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))->exists()) {
            $slug = $base.'-'.$i;
            $i++;
        }

        return $slug;
    }
}
