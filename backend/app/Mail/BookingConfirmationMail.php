<?php

namespace App\Mail;

use App\Models\Reservation;
use App\Models\Setting;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class BookingConfirmationMail extends Mailable
{
    use Queueable, SerializesModels;

    public Carbon $effectiveDeadline;
    public string $checkOutTimeFormatted;
    public string $checkInTimeFormatted;
    public string $hotelAddress;
    public string $hotelPhone;
    public string $hotelEmail;

    public function __construct(
        public Reservation $reservation,
        public string $hotelName = 'Pampanga Home Suites',
    ) {
        $this->effectiveDeadline = $this->computeDeadline($reservation);
        $this->checkOutTimeFormatted = $this->formatCheckOutTime();
        $this->checkInTimeFormatted = '2:00 PM';
        $this->hotelAddress = Setting::where('key', 'hotel_address')->value('value') ?: 'Pampanga, Philippines';
        $this->hotelPhone = Setting::where('key', 'hotel_phone')->value('value') ?: '+63 912 345 6789';
        $this->hotelEmail = Setting::where('key', 'hotel_email')->value('value') ?: 'info@pampangahomesuites.com';
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Booking Confirmed — {$this->reservation->reservation_number}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.BookingConfirmationMail',
            with: [
                'bookingRef' => $this->reservation->reservation_number,
                'roomName' => $this->reservation->room?->roomType?->name ?? 'Room',
                'roomNumber' => $this->reservation->room?->room_number ?? '—',
                'nightsText' => $this->reservation->total_nights . ($this->reservation->total_nights > 1 ? ' nights' : ' night'),
                'guests' => $this->formatGuests(),
                'total' => number_format($this->reservation->total_amount, 2),
                'currency' => '₱',
                'year' => date('Y'),
                'checkIn' => $this->reservation->check_in->format('M d, Y') . ' (from ' . $this->checkInTimeFormatted . ')',
                'checkOut' => $this->reservation->check_out->format('M d, Y') . ' (by ' . $this->checkOutTimeFormatted . ')',
            ],
        );
    }

    private function computeDeadline(Reservation $r): Carbon
    {
        $graceHours = (int) (Setting::where('key', 'auto_cancel_grace_hours')->value('value') ?: 24);
        $checkInDeadline = Carbon::parse($r->check_in)->startOfDay()->addHours(max(1, $graceHours));
        $bookingBuffer = $r->created_at->copy()->addHours(2);

        return $checkInDeadline->greaterThan($bookingBuffer) ? $checkInDeadline : $bookingBuffer;
    }

    private function formatCheckOutTime(): string
    {
        $raw = Setting::where('key', 'check_out_time')->value('value') ?: '11:00';

        return Carbon::parse($raw)->format('g:i A');
    }

    private function formatGuests(): string
    {
        $r = $this->reservation;
        $guests = $r->adults . ' adult' . ($r->adults > 1 ? 's' : '');

        if ($r->children > 0) {
            $guests .= ', ' . $r->children . ' child' . ($r->children > 1 ? 'ren' : '');
        }

        return $guests;
    }
}
