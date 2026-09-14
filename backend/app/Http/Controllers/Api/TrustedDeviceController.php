<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\TrustedDevice;
use Illuminate\Http\Request;

class TrustedDeviceController extends Controller
{
    public function index(Request $request)
    {
        $devices = TrustedDevice::where('user_id', $request->user()->id)
            ->orderByDesc('last_used_at')
            ->get();

        return response()->json($devices);
    }

    public function destroy(Request $request, TrustedDevice $trustedDevice)
    {
        if ($trustedDevice->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $trustedDevice->update(['revoked_at' => now()]);

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'updated',
            'module' => 'auth',
            'model_type' => 'TrustedDevice',
            'model_id' => $trustedDevice->id,
            'description' => "{$request->user()->name} revoked trusted device: {$trustedDevice->device_name}",
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json(['message' => 'Device revoked.']);
    }

    public function revokeAll(Request $request)
    {
        $count = TrustedDevice::where('user_id', $request->user()->id)
            ->active()
            ->update(['revoked_at' => now()]);

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'updated',
            'module' => 'auth',
            'model_type' => 'TrustedDevice',
            'description' => "{$request->user()->name} revoked all {$count} trusted device(s)",
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json(['message' => "All {$count} device(s) revoked."]);
    }
}
