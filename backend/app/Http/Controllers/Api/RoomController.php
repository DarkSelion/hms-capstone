<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\RoomResource;
use App\Models\Reservation;
use App\Models\Room;
use Illuminate\Http\Request;

class RoomController extends Controller
{
    public function index(Request $request)
    {
        $query = Room::with(['roomType', 'images']);

        if ($status = $request->status) {
            $query->where('status', $status);
        }

        if ($floor = $request->floor) {
            $query->where('floor', $floor);
        }

        if ($roomTypeId = $request->room_type_id) {
            $query->where('room_type_id', $roomTypeId);
        }

        if ($search = $request->search) {
            $query->where('room_number', 'like', "%{$search}%");
        }

        if ($request->boolean('all')) {
            $rooms = $query->orderBy('room_number')->get();
            $rooms->transform(fn($room) => new RoomResource($room));

            return response()->json(['data' => $rooms]);
        }

        $rooms = $query->orderBy('room_number')->paginate($request->per_page ?? 10);
        $rooms->getCollection()->transform(fn($room) => new RoomResource($room));

        return response()->json($rooms);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'room_number' => 'required|string|max:10|unique:rooms,room_number',
            'room_type_id' => 'required|exists:room_types,id',
            'floor' => 'required|integer|min:0',
            'bed_type' => 'sometimes|nullable|string|max:50',
            'status' => 'sometimes|in:available,occupied,reserved,dirty,maintenance',
            'cleaning_status' => 'sometimes|in:clean,dirty,in_progress',
            'price_override' => 'required|numeric|min:0',
            'capacity' => 'required|integer|min:1',
            'amenities' => 'nullable|array',
            'description' => 'nullable|string',
            'is_active' => 'sometimes|boolean',
        ]);

        $room = Room::create($this->applyCleaningStatus($data));

        if (isset($data['amenities'])) {
            $room->amenities()->sync($data['amenities']);
        }

        return response()->json(new RoomResource($room->load(['roomType', 'images'])), 201);
    }

    public function show(Room $room)
    {
        return response()->json(new RoomResource($room->load(['roomType', 'amenities', 'images'])));
    }

    public function update(Request $request, Room $room)
    {
        $data = $request->validate([
            'room_number' => 'sometimes|string|max:10|unique:rooms,room_number,' . $room->id,
            'room_type_id' => 'sometimes|exists:room_types,id',
            'floor' => 'sometimes|integer|min:0',
            'bed_type' => 'sometimes|nullable|string|max:50',
            'status' => 'sometimes|in:available,occupied,reserved,dirty,maintenance',
            'cleaning_status' => 'sometimes|in:clean,dirty,in_progress',
            'price_override' => 'sometimes|nullable|numeric|min:0',
            'capacity' => 'sometimes|integer|min:1',
            'amenities' => 'nullable|array',
            'description' => 'nullable|string',
            'notes' => 'nullable|string',
            'is_active' => 'sometimes|boolean',
        ]);

        $room->update($this->applyCleaningStatus($data));

        if (isset($data['amenities'])) {
            $room->amenities()->sync($data['amenities']);
        }

        return response()->json(new RoomResource($room->load(['roomType', 'images'])));
    }

    public function destroy(Room $room)
    {
        if ($room->reservations()->exists()) {
            return response()->json(['message' => 'Cannot delete a room that has reservation history.'], 422);
        }

        $room->delete();

        return response()->json(['message' => 'Room deleted successfully.']);
    }

    public function available(Request $request)
    {
        $data = $request->validate([
            'check_in' => 'required|date',
            'check_out' => 'required|date|after:check_in',
            'room_type_id' => 'nullable|exists:room_types,id',
        ]);

        $query = Room::where('is_active', true)
            ->whereNotIn('status', ['maintenance']);

        if ($roomTypeId = $request->room_type_id) {
            $query->where('room_type_id', $roomTypeId);
        }

        $bookedRoomIds = Reservation::overlapping($data['check_in'], $data['check_out'])->pluck('room_id');

        $rooms = $query->whereNotIn('id', $bookedRoomIds)
            ->with('roomType')
            ->get();

        return response()->json($rooms);
    }

    public function updateStatus(Request $request, Room $room)
    {
        $data = $request->validate([
            'status' => 'required|in:available,occupied,reserved,dirty,maintenance',
            'cleaning_status' => 'sometimes|in:clean,dirty,in_progress',
        ]);

        $room->update($this->applyCleaningStatus($data));

        return response()->json($room->load('roomType'));
    }

    protected function applyCleaningStatus(array $data): array
    {
        if (!isset($data['status']) || array_key_exists('cleaning_status', $data)) {
            return $data;
        }

        $derived = [
            'available' => 'clean',
            'dirty' => 'dirty',
        ];

        if (isset($derived[$data['status']])) {
            $data['cleaning_status'] = $derived[$data['status']];
        }

        return $data;
    }
}
