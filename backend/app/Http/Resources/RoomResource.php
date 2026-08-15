<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RoomResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'room_number' => $this->room_number,
            'room_type' => new RoomTypeResource($this->whenLoaded('roomType')),
            'floor' => $this->floor,
            'bed_type' => $this->bed_type,
            'status' => $this->status,
            'cleaning_status' => $this->cleaning_status,
            'price_override' => $this->price_override,
            'capacity' => $this->capacity,
            'description' => $this->description,
            'notes' => $this->notes,
            'amenities' => AmenityResource::collection($this->whenLoaded('amenities')),
            'images' => RoomImageResource::collection($this->whenLoaded('images')),
        ];
    }
}
