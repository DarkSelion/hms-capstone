<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\InquiryReplyMail;
use App\Models\ActivityLog;
use App\Models\ContactMessage;
use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class ContactMessageController extends Controller
{
    public function index(Request $request)
    {
        $query = ContactMessage::query()->with('replies.user');

        if ($search = $request->search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('subject', 'like', "%{$search}%")
                    ->orWhere('message', 'like', "%{$search}%");
            });
        }

        return response()->json(
            $query->orderBy('created_at', 'desc')->paginate($request->per_page ?? 10)
        );
    }

    public function show(ContactMessage $contactMessage)
    {
        return response()->json($contactMessage->load(['replies.user']));
    }

    public function reply(Request $request, ContactMessage $contactMessage)
    {
        $data = $request->validate([
            'reply' => 'required|string|max:5000',
        ]);

        $hotelName = Setting::where('key', 'hotel_name')->value('value') ?? 'Pampanga Home Suites';

        Mail::to($contactMessage->email)->send(
            new InquiryReplyMail(
                recipientName: $contactMessage->name,
                inquirySubject: $contactMessage->subject,
                replyBody: $data['reply'],
                hotelName: $hotelName,
            )
        );

        $contactMessage->replies()->create([
            'user_id' => $request->user()->id,
            'body' => $data['reply'],
        ]);

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'replied',
            'module' => 'inquiries',
            'model_type' => 'ContactMessage',
            'model_id' => $contactMessage->id,
            'description' => "Replied to inquiry from {$contactMessage->name} ({$contactMessage->email})",
        ]);

        return response()->json($contactMessage->fresh()->load(['replies.user']));
    }

    public function destroy(ContactMessage $contactMessage)
    {
        $contactMessage->delete();

        return response()->json(['message' => 'Message deleted.']);
    }
}
