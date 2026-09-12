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
    ];

    protected function casts(): array
    {
        return [
            'amenities_json' => 'array',
            'is_active' => 'boolean',
            'base_price' => 'decimal:2',
            'size_sqm' => 'decimal:2',
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
}
