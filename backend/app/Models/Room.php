<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Room extends Model
{
    use HasFactory;

    protected $fillable = [
        'room_number',
        'room_type_id',
        'floor',
        'status',
        'cleaning_status',
        'price_override',
        'capacity',
        'description',
        'notes',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'price_override' => 'decimal:2',
        ];
    }

    public function roomType(): BelongsTo
    {
        return $this->belongsTo(RoomType::class);
    }

    public function reservations(): HasMany
    {
        return $this->hasMany(Reservation::class);
    }

    public function housekeepingTasks(): HasMany
    {
        return $this->hasMany(HousekeepingTask::class);
    }

    public function maintenanceRequests(): HasMany
    {
        return $this->hasMany(MaintenanceRequest::class);
    }

    public function amenities(): BelongsToMany
    {
        return $this->belongsToMany(Amenity::class, 'room_amenity');
    }

    public function images(): HasMany
    {
        return $this->hasMany(RoomImage::class)->orderBy('sort_order');
    }

    public function reconcileStatus(): void
    {
        $hasActive = Reservation::where('room_id', $this->id)
            ->active()
            ->exists();

        if ($hasActive) {
            $occupied = Reservation::where('room_id', $this->id)
                ->where('status', 'checked_in')
                ->exists();
            $this->update(['status' => $occupied ? 'occupied' : 'reserved']);

            return;
        }

        $hasOpenMaintenance = MaintenanceRequest::where('room_id', $this->id)
            ->whereNotIn('status', ['completed', 'cancelled'])
            ->exists();

        $this->update(['status' => $hasOpenMaintenance ? 'maintenance' : 'available']);
    }
}
