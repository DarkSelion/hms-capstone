<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RoomTypeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'base_price' => $this->base_price,
            'capacity' => $this->capacity,
            'size_sqm' => $this->size_sqm,
            'bed_type' => $this->bed_type,
            'max_adults' => $this->max_adults,
            'max_children' => $this->max_children,
            'min_capacity' => $this->whenLoaded('rooms', fn() => $this->rooms->pluck('capacity')->filter()->min() ?? $this->capacity, $this->capacity),
            'max_capacity' => $this->whenLoaded('rooms', fn() => $this->rooms->pluck('capacity')->filter()->max() ?? $this->capacity, $this->capacity),
            'amenities_json' => $this->amenities_json,
            'is_active' => $this->is_active,
            'rooms_count' => $this->whenCounted('rooms'),
            'flexible_cancellation_days' => $this->flexible_cancellation_days ?? 1,
            'non_refundable_discount' => $this->non_refundable_discount ?? 10,
            'avg_rating' => $this->avg_rating ?? 0,
            'review_count' => $this->review_count ?? 0,
        ];
    }
}
