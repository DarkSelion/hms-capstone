<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ReservationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'reservation_number' => $this->reservation_number,
            'guest' => new GuestResource($this->whenLoaded('guest')),
            'room' => new RoomResource($this->whenLoaded('room')),
            'status' => $this->status,
            'check_in' => $this->check_in,
            'check_out' => $this->check_out,
            'adults' => $this->adults,
            'children' => $this->children,
            'price_per_night' => $this->price_per_night,
            'total_nights' => $this->total_nights,
            'subtotal' => $this->subtotal,
            'discount_percent' => $this->discount_percent,
            'discount_amount' => $this->discount_amount,
            'tax_percent' => $this->tax_percent,
            'tax_amount' => $this->tax_amount,
            'total_amount' => $this->total_amount,
            'paid_amount' => $this->paid_amount,
            'due_amount' => $this->due_amount,
            'payment_status' => $this->payment_status,
            'special_requests' => $this->special_requests,
            'cancellation_tier' => $this->cancellation_tier,
            'notes' => $this->notes,
            'source' => $this->source,
            'payments' => PaymentResource::collection($this->whenLoaded('payments')),
            'invoices' => InvoiceResource::collection($this->whenLoaded('invoices')),
            'created_at' => $this->created_at,
        ];
    }
}
