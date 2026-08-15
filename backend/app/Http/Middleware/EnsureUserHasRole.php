<?php

namespace App\Http\Middleware;

use App\Models\Guest;
use Closure;
use Illuminate\Http\Request;

class EnsureUserHasRole
{
    public function handle(Request $request, Closure $next, string ...$roles)
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        // Public guests are authenticated via Guest model
        if ($user instanceof Guest) {
            if ($user->is_blacklisted) {
                return response()->json(['message' => 'Your account has been blacklisted. Contact the hotel for assistance.'], 403);
            }
            $userRole = 'guest';
        } else {
            if ($user->is_active === false) {
                return response()->json(['message' => 'Your account is deactivated. Contact an administrator.'], 403);
            }

            $slug = $user->roleSlug() ?? '';
            $roleMap = [
                'super_admin' => 'admin',
                'admin' => 'admin',
                'hotel_manager' => 'admin',
                'receptionist' => 'staff',
                'housekeeping' => 'staff',
                'cashier' => 'staff',
                'staff' => 'staff',
            ];
            $userRole = $roleMap[$slug] ?? $slug;
        }

        if (! empty($roles) && ! in_array($userRole, $roles)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        return $next($request);
    }
}
