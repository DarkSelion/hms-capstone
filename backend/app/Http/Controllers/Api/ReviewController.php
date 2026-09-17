<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Review;
use App\Models\RoomType;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReviewController extends Controller
{
    public function store(Request $request)
    {
        $guest = $request->user();

        $data = $request->validate([
            'reservation_id' => 'required|exists:reservations,id',
            'rating' => 'required|integer|min:1|max:5',
            'title' => 'nullable|string|max:200',
            'comment' => 'nullable|string|max:2000',
        ]);

        $reservation = $reservation = \App\Models\Reservation::findOrFail($data['reservation_id']);

        if ($reservation->guest_id !== $guest->id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        if ($reservation->status !== 'checked_out') {
            return response()->json(['message' => 'You can only review after check-out.'], 422);
        }

        $existing = Review::where('guest_id', $guest->id)
            ->where('reservation_id', $reservation->id)
            ->first();

        if ($existing) {
            return response()->json(['message' => 'You have already reviewed this reservation.'], 422);
        }

        $roomType = $reservation->room->roomType;

        $review = Review::create([
            'guest_id' => $guest->id,
            'reservation_id' => $reservation->id,
            'room_type_id' => $roomType->id,
            'rating' => $data['rating'],
            'title' => isset($data['title']) ? strip_tags($data['title']) : null,
            'comment' => isset($data['comment']) ? strip_tags($data['comment']) : null,
            'is_approved' => true,
        ]);

        $review->approve();

        ActivityLog::create([
            'user_id' => null,
            'action' => 'created',
            'module' => 'reviews',
            'model_type' => 'Review',
            'model_id' => $review->id,
            'description' => "Guest " . \App\Helpers\DataMasker::maskName($guest->full_name) . " submitted a {$data['rating']}-star review for {$roomType->name}",
        ]);

        return response()->json([
            'message' => 'Your review has been published!',
            'review' => $review,
        ], 201);
    }

    public function myReviews(Request $request)
    {
        $guest = $request->user();

        $reviews = Review::where('guest_id', $guest->id)
            ->with(['roomType', 'reservation'])
            ->orderBy('created_at', 'desc')
            ->paginate($request->per_page ?? 10);

        return response()->json($reviews);
    }

    public function index(Request $request)
    {
        $query = Review::with(['guest', 'roomType', 'reservation']);

        if ($request->filled('approved')) {
            $query->where('is_approved', $request->boolean('approved'));
        }

        if ($request->filled('room_type_id')) {
            $query->where('room_type_id', $request->room_type_id);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('comment', 'like', "%{$search}%");
            });
        }

        $reviews = $query->orderBy('created_at', 'desc')
            ->paginate($request->per_page ?? 20);

        return response()->json($reviews);
    }

    public function approve(Request $request, Review $review)
    {
        $review->approve();

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'updated',
            'module' => 'reviews',
            'model_type' => 'Review',
            'model_id' => $review->id,
            'description' => "Approved review #{$review->id} by " . \App\Helpers\DataMasker::maskName($review->guest->full_name),
        ]);

        return response()->json(['message' => 'Review approved.', 'review' => $review->fresh()->load(['guest', 'roomType'])]);
    }

    public function destroy(Request $request, Review $review)
    {
        $roomType = $review->roomType;
        $guestName = $review->guest->full_name;

        $review->delete();
        $roomType->recalculateReviewStats();

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'deleted',
            'module' => 'reviews',
            'model_type' => 'Review',
            'model_id' => $review->id,
            'description' => "Deleted review by " . \App\Helpers\DataMasker::maskName($guestName),
        ]);

        return response()->json(['message' => 'Review deleted.']);
    }

    public function reply(Request $request, Review $review)
    {
        $data = $request->validate([
            'reply' => 'required|string|max:2000',
        ]);

        $review->update([
            'admin_reply' => strip_tags($data['reply']),
            'admin_replied_at' => now(),
        ]);

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'updated',
            'module' => 'reviews',
            'model_type' => 'Review',
            'model_id' => $review->id,
            'description' => "Replied to review #{$review->id}",
        ]);

        return response()->json(['message' => 'Reply saved.', 'review' => $review->fresh()->load(['guest', 'roomType'])]);
    }

    public function publicRoomReviews(string $slug)
    {
        $roomType = RoomType::where('slug', $slug)->firstOrFail();

        $reviews = Review::where('room_type_id', $roomType->id)
            ->where('is_approved', true)
            ->with('guest')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'avg_rating' => $roomType->avg_rating,
            'review_count' => $roomType->review_count,
            'reviews' => $reviews,
        ]);
    }
}
