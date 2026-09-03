<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Guest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $data = $request->validate([
            'first_name' => 'required|string|max:255',
            'last_name' => 'required|string|max:255',
            'email' => 'required|email|unique:guests,email',
            'phone' => 'required|string|max:20|regex:/^(\+63\s?|0)\d{8,13}$/',
            'password' => 'required|string|min:8|confirmed',
            'gender' => 'nullable|string|max:20',
        ]);

        $guest = Guest::create([
            'first_name' => $data['first_name'],
            'last_name' => $data['last_name'],
            'email' => $data['email'],
            'phone' => $data['phone'],
            'password' => Hash::make($data['password']),
            'gender' => $data['gender'] ?? null,
        ]);

        $token = $guest->createToken('portal-token')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $guest,
        ], 201);
    }

    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $guest = Guest::where('email', $data['email'])->first();

        if (! $guest || ! Hash::check($data['password'], $guest->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        if ($guest->is_blacklisted) {
            return response()->json(['message' => 'Account has been deactivated. Please contact support.'], 403);
        }

        $token = $guest->createToken('portal-token')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $guest,
        ]);
    }

    public function me(Request $request)
    {
        return response()->json($request->user());
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['message' => 'Logged out successfully.']);
    }

    public function updateProfile(Request $request)
    {
        $guest = $request->user();

        $data = $request->validate([
            'first_name' => 'sometimes|string|max:255',
            'last_name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|unique:guests,email,'.$guest->id,
            'phone' => 'nullable|string|max:20|regex:/^(\+63\s?|0)\d{8,13}$/',
            'address' => 'nullable|string',
            'city' => 'nullable|string|max:100',
            'country' => 'nullable|string|max:100',
            'nationality' => 'nullable|string|max:100',
            'date_of_birth' => 'nullable|date',
            'gender' => 'nullable|string|max:20',
            'postal_code' => 'nullable|string|max:20',
        ]);

        foreach (['date_of_birth', 'gender', 'postal_code', 'address', 'city', 'country', 'nationality'] as $field) {
            if (($data[$field] ?? null) === '') {
                $data[$field] = null;
            }
        }

        $guest->update($data);

        return response()->json($guest);
    }

    public function updatePassword(Request $request)
    {
        $data = $request->validate([
            'current_password' => 'required|string',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $guest = $request->user();

        if (! Hash::check($data['current_password'], $guest->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['The current password is incorrect.'],
            ]);
        }

        $guest->update(['password' => Hash::make($data['password'])]);

        ActivityLog::create([
            'user_id' => null,
            'action' => 'updated',
            'module' => 'auth',
            'model_type' => 'Guest',
            'model_id' => $guest->id,
            'description' => "Guest {$guest->full_name} changed password",
        ]);

        return response()->json(['message' => 'Password updated successfully.']);
    }

    public function destroyAccount(Request $request)
    {
        $guest = $request->user();

        if ($guest->reservations()->exists()) {
            return response()->json(['message' => 'Cannot delete account with reservation history. Please contact support.'], 422);
        }

        $guest->tokens()->delete();
        $guest->delete();

        return response()->json(['message' => 'Account deleted successfully.']);
    }
}
