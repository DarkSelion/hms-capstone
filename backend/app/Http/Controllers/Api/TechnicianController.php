<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Technician;
use Illuminate\Http\Request;

class TechnicianController extends Controller
{
    public function index()
    {
        return response()->json(
            Technician::orderBy('name')->get()
        );
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:30|regex:/^(\+63\s?|0)\d{8,13}$/',
            'specialty' => 'nullable|string|max:100',
            'is_active' => 'sometimes|boolean',
        ]);

        $technician = Technician::create($data);

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'created',
            'module' => 'maintenance',
            'model_type' => 'Technician',
            'model_id' => $technician->id,
            'description' => "Added technician: {$technician->name}",
        ]);

        return response()->json($technician, 201);
    }

    public function update(Request $request, Technician $technician)
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'phone' => 'nullable|string|max:30|regex:/^(\+63\s?|0)\d{8,13}$/',
            'specialty' => 'nullable|string|max:100',
            'is_active' => 'sometimes|boolean',
        ]);

        $technician->update($data);

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'updated',
            'module' => 'maintenance',
            'model_type' => 'Technician',
            'model_id' => $technician->id,
            'description' => "Updated technician: {$technician->name}",
        ]);

        return response()->json($technician);
    }

    public function destroy(Request $request, Technician $technician)
    {
        $name = $technician->name;

        if ($technician->maintenanceRequests()->exists()) {
            return response()->json(['message' => 'Cannot delete technician with assigned maintenance requests.'], 422);
        }

        $technician->delete();

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'deleted',
            'module' => 'maintenance',
            'model_type' => 'Technician',
            'model_id' => $technician->id,
            'description' => "Deleted technician: {$name}",
        ]);

        return response()->json(['message' => 'Technician deleted successfully.']);
    }
}
