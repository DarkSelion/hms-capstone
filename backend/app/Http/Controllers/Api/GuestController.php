<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Guest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class GuestController extends Controller
{
    public function index(Request $request)
    {
        $query = Guest::query();

        if ($search = $request->search) {
            $query->where(function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        if ($request->boolean('blacklisted')) {
            $query->where('is_blacklisted', true);
        }

        return response()->json(
            $query->withCount(['reservations' => function ($q) {
                $q->whereIn('status', ['pending', 'confirmed', 'checked_in']);
            }])->orderBy('created_at', 'desc')->paginate($request->per_page ?? 10)
        );
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'first_name' => 'required|string|max:255',
            'last_name' => 'required|string|max:255',
            'email' => 'nullable|email|unique:guests,email',
            'phone' => 'required|string|max:20|regex:/^(\+63\s?|0)\d{8,13}$/',
            'address' => 'nullable|string',
            'city' => 'nullable|string|max:100',
            'country' => 'nullable|string|max:100',
            'nationality' => 'nullable|string|max:100',
            'date_of_birth' => 'nullable|date',
            'gender' => 'nullable|in:male,female,other',
            'is_blacklisted' => 'nullable|boolean',
            'blacklist_reason' => 'nullable|string|max:2000',
            'notes' => 'nullable|string',
        ]);

        foreach (['date_of_birth'] as $field) {
            if (($data[$field] ?? null) === '') {
                $data[$field] = null;
            }
        }

        if (!($data['is_blacklisted'] ?? false)) {
            $data['blacklist_reason'] = null;
        }

        $rawPassword = substr(bin2hex(random_bytes(6)), 0, 12);
        $data['password'] = Hash::make($rawPassword);

        $guest = Guest::create($data);

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'created',
            'module' => 'guests',
            'model_type' => 'Guest',
            'model_id' => $guest->id,
            'description' => "Added new guest {$guest->first_name} {$guest->last_name}",
        ]);

        return response()->json(array_merge($guest->toArray(), ['generated_password' => $rawPassword]), 201);
    }

    public function show(Guest $guest)
    {
        $guest->load(['reservations' => function ($q) {
            $q->with('room')->orderBy('created_at', 'desc');
        }]);

        return response()->json($guest);
    }

    public function update(Request $request, Guest $guest)
    {
        $data = $request->validate([
            'first_name' => 'sometimes|string|max:255',
            'last_name' => 'sometimes|string|max:255',
            'email' => 'nullable|email|unique:guests,email,'.$guest->id,
            'phone' => 'sometimes|string|max:20|regex:/^(\+63\s?|0)\d{8,13}$/',
            'address' => 'nullable|string',
            'city' => 'nullable|string|max:100',
            'country' => 'nullable|string|max:100',
            'nationality' => 'nullable|string|max:100',
            'date_of_birth' => 'nullable|date',
            'gender' => 'nullable|in:male,female,other',
            'is_blacklisted' => 'nullable|boolean',
            'blacklist_reason' => 'nullable|string|max:2000',
            'notes' => 'nullable|string',
        ]);

        foreach (['date_of_birth'] as $field) {
            if (($data[$field] ?? null) === '') {
                $data[$field] = null;
            }
        }

        if (!($data['is_blacklisted'] ?? false)) {
            $data['blacklist_reason'] = null;
        }

        $guest->update($data);

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'updated',
            'module' => 'guests',
            'model_type' => 'Guest',
            'model_id' => $guest->id,
            'description' => "Updated guest {$guest->first_name} {$guest->last_name}",
        ]);

        return response()->json($guest);
    }

    public function destroy(Guest $guest)
    {
        if ($guest->reservations()->exists()) {
            return response()->json(['message' => 'Cannot delete guest with reservation history.'], 422);
        }

        $name = "{$guest->first_name} {$guest->last_name}";
        $guest->delete();

        ActivityLog::create([
            'user_id' => request()->user()->id,
            'action' => 'deleted',
            'module' => 'guests',
            'description' => "Deleted guest {$name}",
        ]);

        return response()->json(['message' => 'Guest deleted successfully.']);
    }

    public function history(Guest $guest)
    {
        $reservations = $guest->reservations()
            ->with(['room.roomType'])
            ->orderBy('created_at', 'desc')
            ->paginate(10);

        return response()->json([
            'guest' => $guest,
            'reservations' => $reservations,
        ]);
    }
}
