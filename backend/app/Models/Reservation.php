<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\QueryException;
use Illuminate\Support\Str;

class Reservation extends Model
{
    use HasFactory;

    protected $fillable = [
        'reservation_number',
        'guest_id',
        'room_id',
        'status',
        'check_in',
        'check_out',
        'adults',
        'children',
        'price_per_night',
        'total_nights',
        'subtotal',
        'discount_percent',
        'discount_amount',
        'tax_percent',
        'tax_amount',
        'total_amount',
        'paid_amount',
        'due_amount',
        'payment_status',
        'special_requests',
        'notes',
        'source',
        'confirmed_by',
        'checked_in_by',
        'checked_out_by',
        'created_by',
        'no_show_by',
        'is_overdue',
        'overdue_at',
        'checked_in_at',
        'checked_out_at',
    ];

    protected $appends = [];

    protected function casts(): array
    {
        return [
            'check_in' => 'date:Y-m-d',
            'check_out' => 'date:Y-m-d',
            'checked_in_at' => 'datetime',
            'checked_out_at' => 'datetime',
            'overdue_at' => 'datetime',
            'is_overdue' => 'boolean',
            'price_per_night' => 'decimal:2',
            'subtotal' => 'decimal:2',
            'discount_percent' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'tax_percent' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'total_amount' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'due_amount' => 'decimal:2',
        ];
    }

    public function guest(): BelongsTo
    {
        return $this->belongsTo(Guest::class);
    }

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    public function confirmedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'confirmed_by');
    }

    public function checkedInBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'checked_in_by');
    }

    public function checkedOutBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'checked_out_by');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function scopeActive(Builder $query)
    {
        $query->whereNotIn('status', ['cancelled', 'checked_out', 'no_show']);
    }

    public function scopeOverlapping(Builder $query, string $checkIn, string $checkOut)
    {
        $query->active()
            ->where('check_in', '<', $checkOut)
            ->where('check_out', '>', $checkIn);
    }

    public static function generateReservationNumber(): string
    {
        $year = now()->year;
        $lastId = static::whereBetween('created_at', ["$year-01-01 00:00:00", "$year-12-31 23:59:59"])->max('id') ?? 0;

        return 'BK-'.$year.'-'.str_pad($lastId + 1, 4, '0', STR_PAD_LEFT).'-'.strtoupper(Str::random(4));
    }

    public static function createWithNumber(array $attributes): self
    {
        for ($attempt = 0; $attempt < 3; $attempt++) {
            try {
                $attributes['reservation_number'] = static::generateReservationNumber();

                return static::create($attributes);
            } catch (QueryException $e) {
                if (! str_contains($e->getMessage(), 'reservations.reservation_number')) {
                    throw $e;
                }
            }
        }

        throw new QueryException('', 'reservations insert', [], new \Exception('Unable to allocate a unique reservation number.'));
    }

    /**
     * Single source of truth for a reservation's financial balances.
     * Counts both completed payments AND paid invoices — never overwrite
     * paid_amount/due_amount/payment_status from a single source.
     */
    public function recordedPaid(): float
    {
        return (float) $this->payments()->where('status', 'completed')->sum('amount')
            + (float) $this->invoices()->where('status', 'paid')->sum('total_amount');
    }

    public function reconcileBalances(): void
    {
        $paid = $this->recordedPaid();

        $this->update([
            'paid_amount' => $paid,
            'payment_status' => $paid <= 0
                ? 'unpaid'
                : ($paid >= (float) $this->total_amount ? 'paid' : 'partial'),
            'due_amount' => max(0, (float) $this->total_amount - $paid),
        ]);
    }

    public function hasRecordedPayment(): bool
    {
        return $this->payments()->whereIn('status', ['completed', 'pending'])->exists()
            || $this->invoices()->where('status', 'paid')->exists();
    }

    /**
     * Single source of truth for reservation pricing.
     * Returns the full breakdown for a given check-out date using the live tax rate.
     */
    public function computePricing(string $checkOutDate): array
    {
        $rate = (float) $this->price_per_night;
        $nights = max(1, now()->parse($this->check_in)->diffInDays(now()->parse($checkOutDate)));
        $subtotal = $rate * $nights;
        $discount = $subtotal * ((float) ($this->discount_percent ?? 0) / 100);
        $taxRate = ((float) (Setting::where('key', 'tax_rate')->value('value') ?? 10)) / 100;
        $tax = ($subtotal - $discount) * $taxRate;
        $total = round($subtotal - $discount + $tax, 2);

        return [
            'nights' => $nights,
            'subtotal' => round($subtotal, 2),
            'discount_amount' => round($discount, 2),
            'tax_percent' => $taxRate * 100,
            'tax_amount' => round($tax, 2),
            'total_amount' => $total,
        ];
    }

    /**
     * Flat late check-out fee for same-day late departures.
     * Applies only when the guest departs on their booked check-out date
     * (not on a later date, which bills extra nights) and the current
     * hotel-local time is after the configured check_out_time. Evaluated
     * against the hotel timezone setting so the cutoff matches the
     * property's clock.
     */
    public function lateCheckoutFee(): float
    {
        $fee = (float) (Setting::where('key', 'late_checkout_fee')->value('value') ?? 0);

        if ($fee <= 0) {
            return 0.0;
        }

        $timezone = (string) (Setting::where('key', 'timezone')->value('value') ?? config('app.timezone'));
        $now = now($timezone);
        $checkOut = $this->check_out;

        if ($checkOut === null || $now->toDateString() !== $checkOut->toDateString()) {
            return 0.0;
        }

        $cutoff = (string) (Setting::where('key', 'check_out_time')->value('value') ?? '12:00');

        if ($now->format('H:i') <= $cutoff) {
            return 0.0;
        }

        return $fee;
    }

    /**
     * Single source of truth for the projected check-out balance, mirroring
     * the checkout preview. Returns the total that WILL apply once the guest
     * departs on the given date (extra nights via computePricing, plus the
     * same-day late fee when the departure is unchanged), together with the
     * already-paid amount and the projected balance due.
     *
     * @return array{
     *     actual_check_out: string,
     *     total_nights: int,
     *     subtotal: float,
     *     discount_amount: float,
     *     tax_percent: float,
     *     tax_amount: float,
     *     total_amount: float,
     *     paid_amount: float,
     *     due_amount: float,
     *     late_checkout_fee: float,
     *     late_checkout_applies: bool,
     * }
     */
    public function projectedCheckoutTotal(?string $actualCheckOut = null): array
    {
        $actualCheckOut ??= $this->check_out->lt(now()->startOfDay())
            ? now()->toDateString()
            : $this->check_out->toDateString();

        $lateFee = $actualCheckOut === $this->check_out->toDateString()
            ? $this->lateCheckoutFee()
            : 0.0;

        $pricing = $this->computePricing($actualCheckOut);
        $total = round((float) $pricing['total_amount'] + $lateFee, 2);
        $paid = $this->recordedPaid();

        return [
            'actual_check_out' => $actualCheckOut,
            'total_nights' => (int) $pricing['nights'],
            'subtotal' => (float) $pricing['subtotal'],
            'discount_amount' => (float) $pricing['discount_amount'],
            'tax_percent' => (float) $pricing['tax_percent'],
            'tax_amount' => (float) $pricing['tax_amount'],
            'total_amount' => $total,
            'paid_amount' => $paid,
            'due_amount' => max(0, $total - $paid),
            'late_checkout_fee' => $lateFee,
            'late_checkout_applies' => $lateFee > 0,
        ];
    }
}
