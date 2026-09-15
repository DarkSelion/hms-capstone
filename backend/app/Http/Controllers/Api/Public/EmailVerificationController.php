<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Mail\OtpMail;
use App\Models\Guest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

class EmailVerificationController extends Controller
{
    /**
     * Send a verification OTP to the guest.
     */
    public function send(Request $request)
    {
        $guest = $request->user();

        if ($guest->email_verified_at) {
            return response()->json(['message' => 'Email already verified.']);
        }

        // Delete old OTPs for this guest
        DB::table('otp_codes')->where('email', $guest->email)->delete();

        // Generate 6-digit OTP
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $hashedCode = hash('sha256', $code);

        DB::table('otp_codes')->insert([
            'email' => $guest->email,
            'code' => $hashedCode,
            'expires_at' => now()->addMinutes(15),
            'used' => false,
            'created_at' => now(),
        ]);

        // Send OTP email
        try {
            Mail::to($guest->email)->send(new OtpMail($code, purpose: 'Email Verification Code'));
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Verification OTP email failed', [
                'guest' => $guest->id,
                'error' => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Failed to send verification email. Please try again.'], 500);
        }

        return response()->json(['message' => 'Verification code sent. Please check your inbox.']);
    }

    /**
     * Verify the email with OTP code.
     */
    public function verify(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email',
            'code' => 'required|string|size:6',
        ]);

        $guest = Guest::where('email', $data['email'])->first();

        if (! $guest) {
            throw ValidationException::withMessages([
                'email' => ['No account found with this email.'],
            ]);
        }

        if ($guest->email_verified_at) {
            return response()->json(['message' => 'Email already verified. You can now make reservations.']);
        }

        // Per-email OTP attempt limiting (max 5 per 15 minutes)
        $attemptKey = "email_verify_attempts:{$data['email']}";
        $attempts = (int) Cache::get($attemptKey, 0);
        if ($attempts >= 5) {
            throw ValidationException::withMessages([
                'code' => ['Too many failed attempts. Please request a new code.'],
            ]);
        }

        $otp = DB::table('otp_codes')
            ->where('email', $data['email'])
            ->where('used', false)
            ->where('expires_at', '>', now())
            ->first();

        if (! $otp || ! hash_equals($otp->code, hash('sha256', $data['code']))) {
            Cache::put($attemptKey, $attempts + 1, now()->addMinutes(15));

            throw ValidationException::withMessages([
                'code' => ['The code is invalid or has expired.'],
            ]);
        }

        // Mark as verified (direct assignment — email_verified_at is not in $fillable)
        $guest->email_verified_at = now();
        $guest->save();

        // Mark OTP used and clear attempts
        DB::table('otp_codes')->where('id', $otp->id)->update(['used' => true]);
        Cache::forget("email_verify_attempts:{$data['email']}");

        return response()->json(['message' => 'Email verified successfully. You can now make reservations.']);
    }
}
