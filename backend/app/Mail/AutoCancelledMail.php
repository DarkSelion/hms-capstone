<?php

namespace App\Mail;

use App\Models\Reservation;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class AutoCancelledMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Reservation $reservation,
        public string $hotelName = 'Pampanga Home Suites',
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Booking Cancelled — {$this->reservation->reservation_number}",
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
        $guestName = e($r->guest?->first_name ?? 'Guest');
        $roomName = e($r->room?->roomType?->name ?? 'Room');
        $checkIn = e($r->check_in->format('M d, Y'));
        $checkOut = e($r->check_out->format('M d, Y'));

        return <<<HTML
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="margin:0;padding:0;background-color:#f8f9fa;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
        <div style="max-width:600px;margin:0 auto;background:#ffffff;">
            <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:40px 30px;text-align:center;">
                <h1 style="color:#d4af37;margin:0;font-size:28px;">{$hotel}</h1>
                <p style="color:#e2e8f0;margin:8px 0 0;font-size:14px;">Booking Cancellation Notice</p>
            </div>
            <div style="padding:30px;">
                <p style="color:#334155;font-size:16px;">Dear {$guestName},</p>
                <p style="color:#475569;font-size:15px;line-height:1.6;">
                    We regret to inform you that your booking <strong>{$bookingRef}</strong> has been <strong style="color:#dc2626;">automatically cancelled</strong> because payment was not received within the required grace period.
                </p>
                <div style="background:#f1f5f9;border-radius:12px;padding:20px;margin:20px 0;">
                    <p style="margin:0 0 8px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Booking Details</p>
                    <p style="margin:0;font-size:15px;color:#334155;"><strong>Booking Reference:</strong> {$bookingRef}</p>
                    <p style="margin:4px 0 0;font-size:15px;color:#334155;"><strong>Room:</strong> {$roomName}</p>
                    <p style="margin:4px 0 0;font-size:15px;color:#334155;"><strong>Check-in:</strong> {$checkIn}</p>
                    <p style="margin:4px 0 0;font-size:15px;color:#334155;"><strong>Check-out:</strong> {$checkOut}</p>
                </div>
                <p style="color:#475569;font-size:14px;line-height:1.6;">
                    If you believe this was an error or would like to rebook, please contact us at <a href="mailto:info@pampangahomesuites.com" style="color:#d4af37;">info@pampangahomesuites.com</a> or call <strong>+63 912 345 6789</strong>.
                </p>
                <p style="color:#475569;font-size:14px;margin-top:20px;">We hope to welcome you another time.</p>
                <p style="color:#334155;font-size:14px;margin-top:20px;">Warm regards,<br><strong>{$hotel} Team</strong></p>
            </div>
            <div style="background:#f8f9fa;padding:20px 30px;text-align:center;border-top:1px solid #e2e8f0;">
                <p style="margin:0;font-size:12px;color:#94a3b8;">{$hotel} · Pampanga, Philippines · +63 912 345 6789</p>
            </div>
        </div>
        </body>
        </html>
        HTML;
    }
}
