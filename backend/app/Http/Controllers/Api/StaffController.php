<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\LeaveRequest;
use App\Models\Role;
use App\Models\StaffSchedule;
use App\Models\User;
use Illuminate\Http\Request;

class StaffController extends Controller
{
    public function index(Request $request)
    {
        return response()->json(
            User::with('role')->where('role', '!=', 'guest')->orderBy('name')->paginate($request->per_page ?? 10)
        );
    }

    public function assignable(Request $request)
    {
        $query = User::where('is_active', true)
            ->where('role', '!=', 'guest');

        if ($role = $request->role) {
            $query->whereHas('role', function ($q) use ($role) {
                $q->where('slug', $role);
            });
        }

        return response()->json(
            $query->orderBy('name')->get(['id', 'name'])
        );
    }

    public function roles()
    {
        return response()->json(Role::orderBy('name')->get());
    }

    public function store(Request $request)
    {
        $creatorRole = $request->user()->roleSlug();

        $allowedCreators = ['super_admin', 'admin', 'hotel_manager'];
        if (!in_array($creatorRole, $allowedCreators)) {
            return response()->json(['message' => 'You are not allowed to create staff accounts.'], 403);
        }

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'role_id' => 'required|exists:roles,id',
            'phone' => 'nullable|string|max:20',
            'is_active' => 'sometimes|boolean',
        ]);

        $targetRole = Role::find($data['role_id']);

        if ($creatorRole === 'hotel_manager' && in_array($targetRole->slug, ['super_admin', 'admin', 'hotel_manager'])) {
            return response()->json(['message' => 'Hotel managers cannot create admin-level accounts.'], 403);
        }

        if ($creatorRole === 'admin' && $targetRole->slug === 'super_admin') {
            return response()->json(['message' => 'Admins cannot create super admin accounts.'], 403);
        }

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => $data['password'],
            'role_id' => $data['role_id'],
            'phone' => $data['phone'] ?? null,
            'is_active' => $data['is_active'] ?? true,
        ]);

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'created',
            'module' => 'staff',
            'model_type' => 'User',
            'model_id' => $user->id,
            'description' => "Created staff account: {$user->name} ({$user->email})",
        ]);

        return response()->json($user->load('role'), 201);
    }

    public function show(User $user)
    {
        return response()->json($user->load(['role', 'schedules']));
    }

    public function update(Request $request, User $user)
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|unique:users,email,' . $user->id,
            'phone' => 'nullable|string|max:20',
            'role_id' => 'sometimes|exists:roles,id',
            'is_active' => 'sometimes|boolean',
            'password' => 'sometimes|nullable|string|min:8|confirmed',
        ]);

        $creatorRole = $request->user()->roleSlug();

        $allowedCreators = ['super_admin', 'admin', 'hotel_manager'];
        if (!in_array($creatorRole, $allowedCreators)) {
            return response()->json(['message' => 'You are not allowed to update staff accounts.'], 403);
        }

        if (isset($data['role_id']) && (int) $data['role_id'] !== (int) $user->role_id) {
            $targetRole = Role::find($data['role_id']);

            if ($creatorRole === 'hotel_manager' && in_array($targetRole->slug, ['super_admin', 'admin', 'hotel_manager'])) {
                return response()->json(['message' => 'Hotel managers cannot assign admin-level roles.'], 403);
            }

            if ($creatorRole === 'admin' && $targetRole->slug === 'super_admin') {
                return response()->json(['message' => 'Admins cannot assign the super admin role.'], 403);
            }

            // A super admin is the only one who can change a super admin's role.
            if ($user->roleSlug() === 'super_admin' && $creatorRole !== 'super_admin') {
                return response()->json(['message' => 'Only a super admin can change a super admin\'s role.'], 403);
            }
        }

        // Optional password reset — blank (or absent) keeps the current password.
        $passwordProvided = isset($data['password']) && $data['password'] !== null && $data['password'] !== '';

        if ($passwordProvided) {
            $targetSlug = $user->roleSlug();

            if ($creatorRole === 'hotel_manager' && in_array($targetSlug, ['super_admin', 'admin', 'hotel_manager'])) {
                return response()->json(['message' => 'Hotel managers cannot reset passwords for admin-level accounts.'], 403);
            }

            if ($creatorRole === 'admin' && $targetSlug === 'super_admin') {
                return response()->json(['message' => 'Admins cannot reset the super admin\'s password.'], 403);
            }

            // A super admin is the only one who can reset a super admin's password.
            if ($targetSlug === 'super_admin' && $creatorRole !== 'super_admin') {
                return response()->json(['message' => 'Only a super admin can reset a super admin\'s password.'], 403);
            }
        } else {
            unset($data['password']);
        }

        $user->update($data);

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'updated',
            'module' => 'staff',
            'model_type' => 'User',
            'model_id' => $user->id,
            'description' => $passwordProvided
                ? "Updated staff account and reset password: {$user->name} ({$user->email})"
                : "Updated staff account: {$user->name} ({$user->email})",
        ]);

        return response()->json($user->load('role'));
    }

    public function schedules(Request $request)
    {
        $query = StaffSchedule::with('user');

        if ($date = $request->date) {
            $query->where('date', $date);
        }

        if ($userId = $request->user_id) {
            $query->where('user_id', $userId);
        }

        return response()->json(
            $query->orderBy('date')->paginate($request->per_page ?? 10)
        );
    }

    public function storeSchedule(Request $request)
    {
        $data = $request->validate([
            'user_id' => 'required|exists:users,id',
            'date' => 'required|date',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
            'notes' => 'nullable|string',
        ]);

        $schedule = StaffSchedule::create($data);

        return response()->json($schedule->load('user'), 201);
    }

    public function updateSchedule(Request $request, StaffSchedule $schedule)
    {
        $data = $request->validate([
            'user_id' => 'sometimes|exists:users,id',
            'date' => 'sometimes|date',
            'start_time' => 'sometimes|date_format:H:i',
            'end_time' => 'sometimes|date_format:H:i|after:start_time',
            'notes' => 'nullable|string',
        ]);

        $schedule->update($data);

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'updated',
            'module' => 'schedule',
            'model_type' => 'StaffSchedule',
            'model_id' => $schedule->id,
            'description' => "Updated schedule for {$schedule->user->name} on {$schedule->date->format('Y-m-d')}",
        ]);

        return response()->json($schedule->load('user'));
    }

    public function destroySchedule(Request $request, StaffSchedule $schedule)
    {
        $schedule->delete();

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'deleted',
            'module' => 'schedule',
            'model_type' => 'StaffSchedule',
            'model_id' => $schedule->id,
            'description' => "Deleted schedule for {$schedule->user->name} on {$schedule->date->format('Y-m-d')}",
        ]);

        return response()->json(['message' => 'Schedule removed successfully.']);
    }

    public function leaveRequests(Request $request)
    {
        $query = LeaveRequest::with('user');

        if ($status = $request->status) {
            $query->where('status', $status);
        }

        if ($userId = $request->user_id) {
            $query->where('user_id', $userId);
        }

        return response()->json(
            $query->orderBy('created_at', 'desc')->paginate($request->per_page ?? 10)
        );
    }

    public function storeLeaveRequest(Request $request)
    {
        $data = $request->validate([
            'user_id' => 'required|exists:users,id',
            'type' => 'required|in:sick,annual,personal,other',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'reason' => 'nullable|string',
        ]);

        $data['status'] = 'pending';

        $leaveRequest = LeaveRequest::create($data);

        return response()->json($leaveRequest->load('user'), 201);
    }

    public function updateLeaveRequest(Request $request, LeaveRequest $leaveRequest)
    {
        $data = $request->validate([
            'status' => 'required|in:pending,approved,rejected',
        ]);

        $data['approved_by'] = $request->user()->id;

        $leaveRequest->update($data);

        return response()->json($leaveRequest->load('user'));
    }
}
