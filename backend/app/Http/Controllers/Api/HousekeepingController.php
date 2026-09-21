<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\HousekeepingTask;
use Illuminate\Http\Request;

class HousekeepingController extends Controller
{
    public function index(Request $request)
    {
        $query = HousekeepingTask::with(['room', 'assignedTo']);

        if ($status = $request->status) {
            $query->where('status', $status);
        }

        if ($priority = $request->priority) {
            $query->where('priority', $priority);
        }

        if ($date = $request->date) {
            $query->where('scheduled_date', $date);
        }

        if ($search = $request->search) {
            $query->where(function ($q) use ($search) {
                $q->where('task_type', 'like', "%{$search}%")
                  ->orWhere('notes', 'like', "%{$search}%");
            });
        }

        $sortField = $request->sort_field ?? 'created_at';
        $sortDir = $request->sort_dir ?? 'desc';
        $allowed = ['priority', 'status', 'scheduled_date', 'created_at'];
        $sortField = in_array($sortField, $allowed) ? $sortField : 'created_at';
        $sortDir = in_array(strtolower($sortDir), ['asc', 'desc']) ? $sortDir : 'desc';

        return response()->json(
            $query->orderBy($sortField, $sortDir)->paginate($request->per_page ?? 10)
        );
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'room_id' => 'nullable|exists:rooms,id',
            'task_type' => 'required|string|max:100',
            'notes' => 'nullable|string',
            'priority' => 'sometimes|in:low,normal,medium,high,urgent',
            'scheduled_date' => 'required|date',
            'assigned_to' => 'nullable|exists:users,id',
        ]);

        $data['status'] = 'pending';
        $data['created_by'] = $request->user()->id;

        $task = HousekeepingTask::create($data);

        $roomLabel = $task->room ? "for Room {$task->room->room_number}" : '(no room)';

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'created',
            'module' => 'housekeeping',
            'model_type' => 'HousekeepingTask',
            'model_id' => $task->id,
            'description' => "Created housekeeping task: {$task->task_type} {$roomLabel}",
        ]);

        return response()->json($task->load(['room', 'assignedTo']), 201);
    }

    public function show(HousekeepingTask $task)
    {
        return response()->json($task->load(['room', 'assignedTo']));
    }

    public function update(Request $request, HousekeepingTask $task)
    {
        $data = $request->validate([
            'room_id' => 'sometimes|exists:rooms,id',
            'task_type' => 'sometimes|string|max:100',
            'notes' => 'nullable|string',
            'priority' => 'sometimes|in:low,normal,medium,high,urgent',
            'scheduled_date' => 'sometimes|date',
        ]);

        $task->update($data);

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'updated',
            'module' => 'housekeeping',
            'model_type' => 'HousekeepingTask',
            'model_id' => $task->id,
            'description' => "Updated housekeeping task #{$task->id}",
        ]);

        return response()->json($task->load(['room', 'assignedTo']));
    }

    public function destroy(HousekeepingTask $task)
    {
        if ($task->status !== 'pending') {
            return response()->json(['message' => 'Only pending tasks can be deleted.'], 422);
        }

        $taskType = $task->task_type;
        $task->delete();

        ActivityLog::create([
            'user_id' => request()->user()->id,
            'action' => 'deleted',
            'module' => 'housekeeping',
            'description' => "Deleted housekeeping task: {$taskType}",
        ]);

        return response()->json(['message' => 'Task deleted successfully.']);
    }

    public function updateStatus(Request $request, HousekeepingTask $task)
    {
        $data = $request->validate([
            'status' => 'required|in:pending,in_progress,completed,inspected',
            'completion_notes' => 'nullable|string',
        ]);

        $updates = ['status' => $data['status']];

        if ($data['status'] === 'completed') {
            $updates['completed_at'] = now();
        }

        if ($data['status'] === 'inspected') {
            $updates['inspected_by'] = $request->user()->id;
        }

        $task->update($updates);

        if ($data['status'] === 'completed') {
            if ($task->room) {
                $task->room->update(['cleaning_status' => 'clean']);
                if ($task->room->status === 'dirty') {
                    $task->room->reconcileStatus();
                }
            }
        }

        if ($data['status'] === 'inspected') {
            if ($task->room && $task->room->status === 'dirty') {
                $task->room->reconcileStatus();
            }
        }

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'status_changed',
            'module' => 'housekeeping',
            'model_type' => 'HousekeepingTask',
            'model_id' => $task->id,
            'description' => "Housekeeping task #{$task->id} marked as {$data['status']}",
        ]);

        return response()->json($task->load(['room', 'assignedTo']));
    }

    public function assign(Request $request, HousekeepingTask $task)
    {
        $data = $request->validate([
            'assigned_to' => 'required|exists:users,id',
        ]);

        $task->update([
            'assigned_to' => $data['assigned_to'],
            'status' => 'in_progress',
        ]);

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'assigned',
            'module' => 'housekeeping',
            'model_type' => 'HousekeepingTask',
            'model_id' => $task->id,
            'description' => "Assigned housekeeping task #{$task->id}",
        ]);

        return response()->json($task->load(['room', 'assignedTo']));
    }
}
