<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\MaintenanceRequest;
use App\Models\Room;
use Illuminate\Http\Request;

class MaintenanceController extends Controller
{
    public function index(Request $request)
    {
        $query = MaintenanceRequest::with(['room', 'assignedTo']);

        if ($status = $request->status) {
            $query->where('status', $status);
        }

        if ($priority = $request->priority) {
            $query->where('priority', $priority);
        }

        if ($category = $request->category) {
            $query->where('category', $category);
        }

        if ($search = $request->search) {
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        $sortField = $request->sort_field ?? 'created_at';
        $sortDir = $request->sort_dir ?? 'desc';
        $allowed = ['priority', 'status', 'created_at', 'category'];
        $sortField = in_array($sortField, $allowed) ? $sortField : 'created_at';
        $sortDir = in_array(strtolower($sortDir), ['asc', 'desc']) ? $sortDir : 'desc';

        return response()->json(
            $query->orderBy($sortField, $sortDir)->paginate($request->per_page ?? 10)
        );
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'room_id' => 'required|exists:rooms,id',
            'title' => 'required|string|max:200',
            'description' => 'nullable|string',
            'notes' => 'nullable|string',
            'category' => 'required|string|max:100',
            'priority' => 'sometimes|in:low,medium,high,urgent',
        ]);

        $data['status'] = 'reported';
        $data['reported_by'] = $request->user()->id;

        $maintenance = MaintenanceRequest::create($data);

        if ($maintenance->room && in_array($maintenance->room->status, ['available', 'reserved', 'dirty'])) {
            $maintenance->room->update(['status' => 'maintenance']);
        }

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'created',
            'module' => 'maintenance',
            'model_type' => 'MaintenanceRequest',
            'model_id' => $maintenance->id,
            'description' => "Reported maintenance: {$maintenance->title}",
        ]);

        return response()->json($maintenance->load(['room', 'assignedTo']), 201);
    }

    public function show(MaintenanceRequest $maintenance)
    {
        return response()->json($maintenance->load(['room', 'images', 'assignedTo']));
    }

    public function update(Request $request, MaintenanceRequest $maintenance)
    {
        $data = $request->validate([
            'room_id' => 'sometimes|exists:rooms,id',
            'title' => 'sometimes|string|max:200',
            'description' => 'nullable|string',
            'category' => 'sometimes|string|max:100',
            'priority' => 'sometimes|in:low,medium,high,urgent',
        ]);

        $oldRoomId = $maintenance->room_id;
        $maintenance->update($data);

        if (isset($data['room_id']) && $data['room_id'] !== $oldRoomId) {
            $oldRoom = $oldRoomId ? \App\Models\Room::find($oldRoomId) : null;
            if ($oldRoom) {
                $this->freeRoomIfNoOpenRequests($maintenance, $oldRoom);
            }

            if ($maintenance->room && in_array($maintenance->room->status, ['available', 'reserved', 'dirty'])) {
                $maintenance->room->update(['status' => 'maintenance']);
            }
        }

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'updated',
            'module' => 'maintenance',
            'model_type' => 'MaintenanceRequest',
            'model_id' => $maintenance->id,
            'description' => "Updated maintenance request: {$maintenance->title}",
        ]);

        return response()->json($maintenance->load(['room', 'assignedTo']));
    }

    public function destroy(MaintenanceRequest $maintenance)
    {
        if ($maintenance->status !== 'reported') {
            return response()->json(['message' => 'Only reported requests can be deleted.'], 422);
        }

        $title = $maintenance->title;
        $maintenance->delete();

        $this->freeRoomIfNoOpenRequests($maintenance);

        ActivityLog::create([
            'user_id' => request()->user()->id,
            'action' => 'deleted',
            'module' => 'maintenance',
            'description' => "Deleted maintenance request: {$title}",
        ]);

        return response()->json(['message' => 'Maintenance request deleted successfully.']);
    }

    public function updateStatus(Request $request, MaintenanceRequest $maintenance)
    {
        $data = $request->validate([
            'status' => 'required|in:reported,assigned,in_progress,completed,cancelled',
            'resolution_notes' => 'nullable|string',
            'actual_cost' => 'nullable|numeric|min:0',
        ]);

        $updates = ['status' => $data['status']];

        if ($data['status'] === 'in_progress') {
            $updates['started_at'] = now();
        }

        if ($data['status'] === 'completed') {
            $updates['completed_at'] = now();
            if (isset($data['resolution_notes'])) {
                $updates['resolution_notes'] = $data['resolution_notes'];
            }
            if (isset($data['actual_cost'])) {
                $updates['actual_cost'] = $data['actual_cost'];
            }
        }

        $maintenance->update($updates);

        if (in_array($data['status'], ['completed', 'cancelled'])) {
            $this->freeRoomIfNoOpenRequests($maintenance);
        }

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'status_changed',
            'module' => 'maintenance',
            'model_type' => 'MaintenanceRequest',
            'model_id' => $maintenance->id,
            'description' => "Maintenance request \"{$maintenance->title}\" marked as {$data['status']}",
        ]);

        return response()->json($maintenance->load(['room', 'assignedTo']));
    }

    public function assign(Request $request, MaintenanceRequest $maintenance)
    {
        $data = $request->validate([
            'assigned_to' => 'required|exists:technicians,id',
            'estimated_cost' => 'nullable|numeric|min:0',
        ]);

        $maintenance->update([
            'assigned_to' => $data['assigned_to'],
            'estimated_cost' => $data['estimated_cost'] ?? $maintenance->estimated_cost,
            'status' => 'assigned',
        ]);

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'assigned',
            'module' => 'maintenance',
            'model_type' => 'MaintenanceRequest',
            'model_id' => $maintenance->id,
            'description' => "Assigned maintenance request: {$maintenance->title}",
        ]);

        return response()->json($maintenance->load(['room', 'assignedTo']));
    }

    private function freeRoomIfNoOpenRequests(MaintenanceRequest $maintenance, ?Room $room = null): void
    {
        $room = $room ?? $maintenance->room;

        if (! $room) {
            return;
        }

        $hasOpen = MaintenanceRequest::where('room_id', $room->id)
            ->where('id', '!=', $maintenance->id)
            ->whereNotIn('status', ['completed', 'cancelled'])
            ->exists();

        if (! $hasOpen) {
            // After maintenance, room goes to dirty for housekeeping inspection
            // (not directly to available — must be cleaned first)
            if (in_array($room->status, ['maintenance'])) {
                $room->update(['status' => 'dirty', 'cleaning_status' => 'dirty']);
            } else {
                $room->reconcileStatus();
            }
        }
    }
}
