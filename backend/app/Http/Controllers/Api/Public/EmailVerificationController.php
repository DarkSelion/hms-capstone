<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Mail\VerificationEmailMail;
use App\Models\Guest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class EmailVerificationController extends Controller
{
    /**
     * Send a verification email to the guest.
     */
    public function send(Request $request)
    {
        $guest = $request->user();

        if ($guest->email_verified_at) {
            return response()->json(['message' => 'Email already verified.']);
        }

        // Rate limit: max 3 per hour per guest
        $rateKey = "email_verify_sent:{$guest->id}";
        if (Cache::has($rateKey)) {
            return response()->json(['message' => 'Verification email already sent. Please check your inbox.']);
        }

        // Generate token
        $token = bin2hex(random_bytes(32));
        $hashedToken = hash('sha256', $token);

        // Store hashed token (delete old ones first)
        DB::table('email_verification_tokens')
            ->where('guest_id', $guest->id)
            ->delete();

        DB::table('email_verification_tokens')->insert([
            'guest_id' => $guest->id,
            'token' => $hashedToken,
            'expires_at' => now()->addHours(24),
            'created_at' => now(),
        ]);

        // Build verification URL
        $verificationUrl = url("/public/verify-email?token={$token}&email=" . urlencode($guest->email));

        // Send email
        try {
            Mail::to($guest->email)->send(new VerificationEmailMail($verificationUrl));
            Cache::put($rateKey, true, now()->addHour());
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Verification email failed', [
                'guest' => $guest->id,
                'error' => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Failed to send verification email. Please try again.'], 500);
        }

        return response()->json(['message' => 'Verification email sent. Please check your inbox.']);
    }

    /**
     * Verify the email with the token.
     */
    public function verify(Request $request)
    {
        $data = $request->validate([
            'token' => 'required|string',
            'email' => 'required|email',
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

        $hashedToken = hash('sha256', $data['token']);

        $tokenRecord = DB::table('email_verification_tokens')
            ->where('guest_id', $guest->id)
            ->where('token', $hashedToken)
            ->where('expires_at', '>', now())
            ->first();

        if (! $tokenRecord) {
            throw ValidationException::withMessages([
                'token' => ['Invalid or expired verification link.'],
            ]);
        }

        // Mark as verified
        $guest->update(['email_verified_at' => now()]);

        // Delete used token
        DB::table('email_verification_tokens')
            ->where('guest_id', $guest->id)
            ->delete();

        return response()->json(['message' => 'Email verified successfully. You can now make reservations.']);
    }
}
