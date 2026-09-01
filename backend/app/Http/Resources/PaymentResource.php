<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PaymentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'reservation_id' => $this->reservation_id,
            'guest_id' => $this->guest_id,
            'amount' => $this->amount,
            'payment_method' => $this->payment_method,
            'payment_type' => $this->payment_type,
            'status' => $this->status,
            'transaction_id' => $this->transaction_id,
            'reference_number' => $this->reference_number,
            'refund_gateway_id' => $this->refund_gateway_id,
            'notes' => $this->notes,
            'processed_by' => $this->processed_by,
            'paid_at' => $this->paid_at,
            'created_at' => $this->created_at,
        ];
    }
}
