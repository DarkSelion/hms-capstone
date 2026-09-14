<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Models\ContactMessage;
use Illuminate\Http\Request;

class ContactController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255',
            'subject' => 'required|string|max:255',
            'message' => 'required|string|max:5000',
            'website' => 'nullable|string|max:255',
        ]);

        if (!empty($data['website'])) {
            return response()->json([
                'message' => 'Message sent successfully.',
            ], 201);
        }

        $message = ContactMessage::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'subject' => $data['subject'],
            'message' => $data['message'],
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'message' => 'Message sent successfully.',
        ], 201);
    }
}
