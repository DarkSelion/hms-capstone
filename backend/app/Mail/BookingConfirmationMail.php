<?php

namespace App\Mail;

use App\Models\Reservation;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class BookingConfirmationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Reservation $reservation,
        public string $hotelName = 'Pampanga Home Suites',
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Booking Confirmed — {$this->reservation->reservation_number}",
        );
    }

    public function content(): Content
    {
        return new Content(
            htmlString: $this->buildHtml(),
        );
    }

    private function buildHtml(): string
    {
        $r = $this->reservation;
        $hotel = e($this->hotelName);
        $bookingRef = e($r->reservation_number);
        $roomName = e($r->room?->roomType?->name ?? 'Room');
        $roomNumber = e($r->room?->room_number ?? '—');
        $checkIn = e($r->check_in->format('M d, Y'));
        $checkOut = e($r->check_out->format('M d, Y'));
        $nights = $r->total_nights;
        $guests = $r->adults . ' adult' . ($r->adults > 1 ? 's' : '');
        if ($r->children > 0) {
            $guests .= ', ' . $r->children . ' child' . ($r->children > 1 ? 'ren' : '');
        }
        $total = number_format($r->total_amount, 2);
        $currency = '₱';
        $year = date('Y');
        $checkOutTime = '12:00 PM';
        $policy = e($r->cancellation_tier === 'non_refundable'
            ? 'Non-refundable rate — no changes or refunds.'
            : 'Free cancellation up to 24 hours before check-in.');

        return <<<HTML
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#12233A;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#12233A;padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background-color:#1a2d47;border-radius:16px;overflow:hidden;border:1px solid rgba(192,160,98,0.15);">
        <tr><td style="padding:40px 40px 20px;text-align:center;">
          <div style="font-size:24px;font-weight:300;letter-spacing:2px;color:#C0A062;font-family:Georgia,serif;">{$hotel}</div>
          <div style="width:40px;height:2px;background:#C0A062;margin:16px auto 0;border-radius:1px;"></div>
        </td></tr>
        <tr><td style="padding:20px 40px;">
          <h2 style="color:#ffffff;font-size:20px;font-weight:400;margin:0 0 8px;text-align:center;">Booking Confirmed!</h2>
          <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.6;margin:0 0 24px;text-align:center;">
            Your reservation has been successfully booked. We look forward to hosting you!
          </p>
          <div style="background:rgba(192,160,98,0.1);border:1px solid rgba(192,160,98,0.2);border-radius:12px;padding:16px;text-align:center;margin:0 0 24px;">
            <p style="color:rgba(255,255,255,0.4);font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0 0 6px;">Booking Reference</p>
            <div style="font-size:22px;font-weight:700;letter-spacing:3px;color:#C0A062;font-family:'Courier New',monospace;">{$bookingRef}</div>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr><td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="color:rgba(255,255,255,0.4);font-size:12px;">Room</span><br>
              <span style="color:#ffffff;font-size:14px;">{$roomName} — Room {$roomNumber}</span>
            </td></tr>
            <tr><td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="color:rgba(255,255,255,0.4);font-size:12px;">Check-in</span><br>
              <span style="color:#ffffff;font-size:14px;">{$checkIn}</span>
            </td></tr>
            <tr><td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="color:rgba(255,255,255,0.4);font-size:12px;">Check-out</span><br>
              <span style="color:#ffffff;font-size:14px;">{$checkOut} (by {$checkOutTime})</span>
            </td></tr>
            <tr><td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="color:rgba(255,255,255,0.4);font-size:12px;">Duration</span><br>
              <span style="color:#ffffff;font-size:14px;">{$nights} night{$nights > 1 ? 's' : ''}</span>
            </td></tr>
            <tr><td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="color:rgba(255,255,255,0.4);font-size:12px;">Guests</span><br>
              <span style="color:#ffffff;font-size:14px;">{$guests}</span>
            </td></tr>
            <tr><td style="padding:12px 0;">
              <span style="color:rgba(255,255,255,0.4);font-size:12px;">Total Amount</span><br>
              <span style="color:#C0A062;font-size:18px;font-weight:600;">{$currency}{$total}</span>
            </td></tr>
          </table>
          <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:14px 16px;margin:0 0 24px;">
            <p style="color:rgba(255,255,255,0.4);font-size:11px;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 6px;">Cancellation Policy</p>
            <p style="color:rgba(255,255,255,0.6);font-size:13px;margin:0;">{$policy}</p>
          </div>
        </td></tr>
        <tr><td style="padding:20px 40px 30px;border-top:1px solid rgba(255,255,255,0.05);text-align:center;">
          <p style="color:rgba(255,255,255,0.25);font-size:11px;margin:0 0 8px;">Manage your booking at <a href="https://pampangahomesuites.duckdns.org/public/my-reservations" style="color:#C0A062;text-decoration:none;">My Reservations</a></p>
          <p style="color:rgba(255,255,255,0.25);font-size:11px;margin:0;">&copy; {$year} {$hotel}. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
HTML;
    }
}
