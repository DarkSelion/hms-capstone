<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Review extends Model
{
    use HasFactory;

    protected $fillable = [
        'guest_id',
        'reservation_id',
        'room_type_id',
        'rating',
        'title',
        'comment',
        'is_approved',
        'admin_reply',
        'admin_replied_at',
    ];

    protected function casts(): array
    {
        return [
            'rating' => 'integer',
            'is_approved' => 'boolean',
            'admin_replied_at' => 'datetime',
        ];
    }

    public function guest(): BelongsTo
    {
        return $this->belongsTo(Guest::class);
    }

    public function reservation(): BelongsTo
    {
        return $this->belongsTo(Reservation::class);
    }

    public function roomType(): BelongsTo
    {
        return $this->belongsTo(RoomType::class);
    }

    public function approve(): void
    {
        $this->update(['is_approved' => true]);
        $this->recalculateRoomTypeStats();
    }

    public function reject(): void
    {
        $this->delete();
        $this->roomType->recalculateReviewStats();
    }

    public function recalculateRoomTypeStats(): void
    {
        $this->roomType->recalculateReviewStats();
    }
}
