<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RoomType extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'description',
        'base_price',
        'capacity',
        'size_sqm',
        'bed_type',
        'max_adults',
        'max_children',
        'amenities_json',
        'is_active',
        'sort_order',
        'flexible_cancellation_days',
        'non_refundable_discount',
        'avg_rating',
        'review_count',
    ];

    protected function casts(): array
    {
        return [
            'amenities_json' => 'array',
            'is_active' => 'boolean',
            'base_price' => 'decimal:2',
            'size_sqm' => 'decimal:2',
            'flexible_cancellation_days' => 'integer',
            'non_refundable_discount' => 'decimal:2',
            'avg_rating' => 'decimal:2',
            'review_count' => 'integer',
        ];
    }

    public function rooms(): HasMany
    {
        return $this->hasMany(Room::class);
    }

    public function typeImages(): HasMany
    {
        return $this->hasMany(RoomTypeImage::class);
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(Review::class);
    }

    public function recalculateReviewStats(): void
    {
        $stats = $this->reviews()->where('status', 'approved')
            ->selectRaw('AVG(rating) as avg, COUNT(*) as count')
            ->first();

        $this->update([
            'avg_rating' => round($stats->avg ?? 0, 2),
            'review_count' => $stats->count ?? 0,
        ]);
    }
}
