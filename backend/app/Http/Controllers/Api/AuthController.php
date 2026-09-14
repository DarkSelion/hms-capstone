<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\OtpMail;
use App\Mail\SuspiciousLoginMail;
use App\Models\ActivityLog;
use App\Models\TrustedDevice;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Login step 1: Validate credentials, check lockout, generate OTP.
     * If device is trusted, skip OTP and issue token directly.
     */
    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
            'device_hash' => 'nullable|string|max:64',
        ]);

        $email = $data['email'];
        $ip = $request->ip();

        // ── Progressive account lockout (per email) ──
        $lockoutKey = "login_locked:{$email}";
        if (Cache::has($lockoutKey)) {
            $ttlMinutes = (int) Cache::get("login_lockout_ttl:{$email}", 1);
            return response()->json([
                'message' => "Account locked due to too many failed attempts. Try again in {$ttlMinutes} minute" . ($ttlMinutes !== 1 ? 's' : '') . '.',
            ], 429);
        }

        // ── IP-level throttle (backup for shared hotel network) ──
        $ipAttempts = (int) Cache::get("login_ip_attempts:{$ip}", 0);
        if ($ipAttempts >= 20) {
            return response()->json([
                'message' => 'Too many login attempts from this network. Please try again later.',
            ], 429);
        }

        $user = User::where('email', $email)->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            // Track failed attempts (per email)
            $attempts = (int) Cache::get("login_attempts:{$email}", 0) + 1;
            Cache::put("login_attempts:{$email}", $attempts, now()->addMinutes(30));

            // Track IP attempts
            Cache::put("login_ip_attempts:{$ip}", $ipAttempts + 1, now()->addMinutes(15));

            // Progressive lockout tiers
            $lockoutDuration = $this->getLockoutDuration($attempts);
            if ($lockoutDuration > 0) {
                Cache::put($lockoutKey, true, now()->addMinutes($lockoutDuration));
                Cache::put("login_lockout_ttl:{$email}", $lockoutDuration, now()->addMinutes($lockoutDuration));
                Log::warning("Account locked: {$email} — {$attempts} failed login attempts, locked for {$lockoutDuration}min from {$ip}");

                // Alert admin after 15+ failures
                if ($attempts >= 15) {
                    try {
                        Mail::to('admin@hotel.com')->send(new SuspiciousLoginMail(
                            user: $user ?? (object) ['name' => 'Unknown', 'email' => $email],
                            ip: $ip,
                            userAgent: $request->userAgent(),
                        ));
                    } catch (\Throwable $e) {
                        Log::warning('Lockout alert email failed', ['error' => $e->getMessage()]);
                    }
                }
            }

            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        if ($user->is_active === false) {
            return response()->json(['message' => 'Your account is deactivated. Contact an administrator.'], 403);
        }

        // ── Clear failed attempts on success ──
        Cache::forget("login_attempts:{$email}");
        Cache::forget($lockoutKey);
        Cache::forget("login_ip_attempts:{$ip}");

        // ── Check if device is trusted (skip OTP) ──
        $deviceHash = $data['device_hash'] ?? null;
        if ($deviceHash) {
            $trustedDevice = TrustedDevice::where('user_id', $user->id)
                ->where('device_hash', $deviceHash)
                ->active()
                ->first();

            if ($trustedDevice) {
                // Trusted device — skip OTP, issue token directly
                $trustedDevice->update(['last_used_at' => now(), 'ip_address' => $ip]);

                return $this->issueToken($user, $request, 'Trusted device login');
            }
        }

        // ── Generate OTP and send via email ──
        DB::table('otp_codes')->where('email', $user->email)->delete();

        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $hashedCode = hash('sha256', $code);

        DB::table('otp_codes')->insert([
            'email' => $user->email,
            'code' => $hashedCode,
            'expires_at' => now()->addMinutes(5),
            'used' => false,
            'created_at' => now(),
        ]);

        try {
            Mail::to($user->email)->send(new OtpMail($code, 'Pampanga Home Suites', 'Staff Login Verification'));
        } catch (\Throwable $e) {
            Log::warning('Staff OTP email failed', [
                'email' => $user->email,
                'error' => $e->getMessage(),
            ]);
        }

        // Issue a short-lived temp token for the OTP verification step
        $tempToken = Str::random(60);
        Cache::put("staff_otp_user:{$tempToken}", [
            'user_id' => $user->id,
            'ip' => $ip,
            'attempts' => 0,
            'device_hash' => $deviceHash,
        ], now()->addMinutes(5));

        return response()->json([
            'requires_otp' => true,
            'temp_token' => $tempToken,
            'message' => 'A verification code has been sent to your email.',
        ]);
    }

    /**
     * Login step 2: Verify OTP and issue auth token.
     */
    public function verifyLoginOtp(Request $request)
    {
        $data = $request->validate([
            'temp_token' => 'required|string',
            'otp' => 'required|string|size:6',
            'trust_device' => 'sometimes|boolean',
            'device_name' => 'nullable|string|max:255',
        ]);

        $tempData = Cache::pull("staff_otp_user:{$data['temp_token']}");
        if (! $tempData || ! is_array($tempData)) {
            throw ValidationException::withMessages([
                'temp_token' => ['Verification expired. Please log in again.'],
            ]);
        }

        $userId = $tempData['user_id'];
        $storedIp = $tempData['ip'];
        $otpAttempts = $tempData['attempts'] ?? 0;
        $deviceHash = $tempData['device_hash'] ?? null;

        // Check OTP attempt limit (max 5 per temp token)
        if ($otpAttempts >= 5) {
            throw ValidationException::withMessages([
                'otp' => ['Too many failed attempts. Please log in again.'],
            ]);
        }

        $user = User::find($userId);
        if (! $user) {
            throw ValidationException::withMessages([
                'temp_token' => ['User not found.'],
            ]);
        }

        $otp = DB::table('otp_codes')
            ->where('email', $user->email)
            ->where('used', false)
            ->where('expires_at', '>', now())
            ->first();

        if (! $otp || ! hash_equals($otp->code, hash('sha256', $data['otp']))) {
            // Increment OTP attempts and re-store (don't delete the temp token yet)
            Cache::put("staff_otp_user:{$data['temp_token']}", [
                ...$tempData,
                'attempts' => $otpAttempts + 1,
            ], now()->addMinutes(5));

            throw ValidationException::withMessages([
                'otp' => ['The code is invalid or has expired.'],
            ]);
        }

        // Mark OTP as used
        DB::table('otp_codes')->where('id', $otp->id)->update(['used' => true]);

        // Log if IP changed between login step 1 and OTP verification (informational)
        $currentIp = $request->ip();
        if ($currentIp !== $storedIp) {
            Log::info('OTP verified from different IP', [
                'user' => $user->id,
                'login_ip' => $storedIp,
                'verify_ip' => $currentIp,
            ]);
        }

        // ── Optionally trust this device ──
        if (! empty($data['trust_device']) && $deviceHash) {
            $browser = $this->parseBrowser($request->userAgent());
            $os = $this->parseOs($request->userAgent());
            $deviceName = $data['device_name'] ?: "{$browser} on {$os}";

            TrustedDevice::updateOrCreate(
                [
                    'user_id' => $user->id,
                    'device_hash' => $deviceHash,
                ],
                [
                    'device_name' => $deviceName,
                    'browser' => $browser,
                    'operating_system' => $os,
                    'ip_address' => $currentIp,
                    'last_used_at' => now(),
                    'revoked_at' => null,
                ]
            );
        }

        return $this->issueToken($user, $request, 'OTP verified');
    }

    /**
     * Rotate the current token (extend session).
     */
    public function refreshToken(Request $request)
    {
        $user = $request->user();
        $currentToken = $user->currentAccessToken();

        // Create new token
        $newToken = $user->createToken('api-token')->plainTextToken;

        // Revoke old token
        $currentToken->delete();

        // Log the rotation
        ActivityLog::create([
            'user_id' => $user->id,
            'action' => 'updated',
            'module' => 'auth',
            'model_type' => 'User',
            'model_id' => $user->id,
            'description' => "{$user->name} refreshed authentication token",
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json([
            'token' => $newToken,
            'expires_at' => now()->addHours(24)->toIso8601String(),
        ]);
    }

    public function logout(Request $request)
    {
        $user = $request->user();

        ActivityLog::create([
            'user_id' => $user->id,
            'action' => 'logout',
            'module' => 'auth',
            'description' => "{$user->name} logged out",
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        $user->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out successfully.']);
    }

    public function me(Request $request)
    {
        return response()->json($request->user()->load('role'));
    }

    public function updateProfile(Request $request)
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|unique:users,email,'.$request->user()->id,
            'phone' => 'nullable|string|max:20|regex:/^[+]?[0-9]{10,15}$/',
            'avatar' => 'nullable|string|max:255',
        ]);

        $request->user()->update($data);

        return response()->json($request->user());
    }

    public function updatePassword(Request $request)
    {
        $data = $request->validate([
            'current_password' => 'required|string',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $user = $request->user();

        if (! Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['The current password is incorrect.'],
            ]);
        }

        $user->update(['password' => Hash::make($data['password'])]);

        // Revoke all other tokens (keep current session)
        $currentTokenId = $request->user()->currentAccessToken()->id;
        $user->tokens()->where('id', '!=', $currentTokenId)->delete();

        ActivityLog::create([
            'user_id' => $user->id,
            'action' => 'updated',
            'module' => 'auth',
            'model_type' => 'User',
            'model_id' => $user->id,
            'description' => "{$user->name} changed password — other sessions revoked",
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json(['message' => 'Password updated successfully. Other sessions have been ended.']);
    }

    public function loginHistory(Request $request)
    {
        $logs = ActivityLog::where('user_id', $request->user()->id)
            ->whereIn('action', ['login', 'logout'])
            ->orderByDesc('created_at')
            ->limit(10)
            ->get(['action', 'description', 'ip_address', 'user_agent', 'created_at']);

        return response()->json($logs);
    }

    public function tokenInfo(Request $request)
    {
        $token = $request->user()->currentAccessToken();

        return response()->json([
            'expires_at' => $token->expires_at?->toIso8601String(),
            'last_used_at' => $token->last_used_at?->toIso8601String(),
        ]);
    }

    /**
     * Revoke all tokens and trusted devices for a user.
     * Used by admin (staff deactivation) and self-service.
     */
    public function revokeAllSessions(Request $request, ?User $user = null)
    {
        $target = $user ?? $request->user();
        $actor = $request->user();

        // Revoke all tokens
        $target->tokens()->delete();

        // Revoke all trusted devices
        $target->trustedDevices()->active()->update(['revoked_at' => now()]);

        ActivityLog::create([
            'user_id' => $actor->id,
            'action' => 'updated',
            'module' => 'auth',
            'model_type' => 'User',
            'model_id' => $target->id,
            'description' => $actor->id === $target->id
                ? "{$actor->name} revoked all their sessions"
                : "{$actor->name} revoked all sessions for {$target->name}",
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json(['message' => 'All sessions have been revoked.']);
    }

    // ── Private helpers ──

    /**
     * Issue a Sanctum token and return the standard login response.
     */
    private function issueToken(User $user, Request $request, string $context): \Illuminate\Http\JsonResponse
    {
        // Single session — revoke all existing tokens before issuing new one
        $user->tokens()->delete();

        $user->forceFill([
            'last_login_at' => now(),
            'last_login_ip' => $request->ip(),
            'last_login_user_agent' => $request->userAgent(),
        ])->save();

        $token = $user->createToken('api-token')->plainTextToken;

        ActivityLog::create([
            'user_id' => $user->id,
            'action' => 'login',
            'module' => 'auth',
            'description' => "{$user->name} logged in from {$request->ip()} ({$context})",
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        $this->checkSuspiciousLogin($user, $request);

        return response()->json([
            'token' => $token,
            'user' => $user->load('role'),
        ]);
    }

    /**
     * Progressive lockout duration in minutes based on attempt count.
     * Returns 0 if no lockout needed.
     */
    private function getLockoutDuration(int $attempts): int
    {
        return match (true) {
            $attempts >= 15 => 30,
            $attempts >= 10 => 15,
            $attempts >= 8 => 5,
            $attempts >= 5 => 1,
            default => 0,
        };
    }

    /**
     * Parse browser name from user-agent string.
     */
    private function parseBrowser(?string $ua): string
    {
        if (! $ua) return 'Unknown';
        if (str_contains($ua, 'Edg/')) return 'Edge';
        if (str_contains($ua, 'OPR/') || str_contains($ua, 'Opera')) return 'Opera';
        if (str_contains($ua, 'Chrome') && !str_contains($ua, 'Edg/')) return 'Chrome';
        if (str_contains($ua, 'Firefox')) return 'Firefox';
        if (str_contains($ua, 'Safari') && !str_contains($ua, 'Chrome')) return 'Safari';
        return 'Other';
    }

    /**
     * Parse operating system from user-agent string.
     */
    private function parseOs(?string $ua): string
    {
        if (! $ua) return 'Unknown';
        if (str_contains($ua, 'Windows NT 10')) return 'Windows 10/11';
        if (str_contains($ua, 'Windows NT')) return 'Windows';
        if (str_contains($ua, 'Mac OS X')) return 'macOS';
        if (str_contains($ua, 'Linux') && !str_contains($ua, 'Android')) return 'Linux';
        if (str_contains($ua, 'Android')) return 'Android';
        if (str_contains($ua, 'iPhone') || str_contains($ua, 'iPad')) return 'iOS';
        return 'Other';
    }

    /**
     * Suspicious login detection — compare IP against known IPs.
     */
    private function checkSuspiciousLogin(User $user, Request $request): void
    {
        $currentIp = $request->ip();
        $knownIps = Cache::get("user_known_ips:{$user->id}", []);

        if (! empty($knownIps) && ! in_array($currentIp, $knownIps)) {
            try {
                Mail::to('admin@hotel.com')->send(new SuspiciousLoginMail(
                    user: $user,
                    ip: $currentIp,
                    userAgent: $request->userAgent(),
                ));
            } catch (\Throwable $e) {
                Log::warning('Suspicious login alert failed', [
                    'user' => $user->id,
                    'error' => $e->getMessage(),
                ]);
            }

            ActivityLog::create([
                'user_id' => $user->id,
                'action' => 'suspicious_login',
                'module' => 'auth',
                'description' => "Login from new IP {$currentIp} by {$user->name}",
                'ip_address' => $currentIp,
                'user_agent' => $request->userAgent(),
            ]);
        }

        $knownIps[] = $currentIp;
        $knownIps = array_unique(array_slice($knownIps, -10));
        Cache::put("user_known_ips:{$user->id}", $knownIps, now()->addDays(90));
    }
}
