<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    public function index(Request $request)
    {
        $query = ActivityLog::with('user');

        if ($search = $request->search) {
            $safe = addcslashes($search, '%_\\');
            $query->where(function ($q) use ($safe) {
                $q->where('description', 'like', "%{$safe}%")
                    ->orWhereHas('user', function ($u) use ($safe) {
                        $u->where('name', 'like', "%{$safe}%");
                    });
            });
        }

        if ($module = $request->module) {
            $query->where('module', $module);
        }

        if ($action = $request->action) {
            $query->where('action', $action);
        }

        if ($userId = $request->user_id) {
            $query->where('user_id', $userId);
        }

        if ($scope = $request->scope) {
            if ($scope === 'staff') {
                $query->whereNotNull('user_id');
            } elseif ($scope === 'guest') {
                $query->whereNull('user_id');
            }
        }

        return response()->json(
            $query->orderBy('created_at', 'desc')->paginate($request->per_page ?? 10)
        );
    }
}
