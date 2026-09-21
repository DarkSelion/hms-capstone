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
        'status',
        'is_verified_stay',
        'admin_response',
        'admin_replied_at',
    ];

    protected function casts(): array
    {
        return [
            'rating' => 'integer',
            'is_verified_stay' => 'boolean',
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
        $this->update(['status' => 'approved']);
        $this->recalculateRoomTypeStats();
    }

    public function reject(): void
    {
        $this->update(['status' => 'rejected']);
        $this->recalculateRoomTypeStats();
    }

    public function recalculateRoomTypeStats(): void
    {
        $this->roomType->recalculateReviewStats();
    }
}
