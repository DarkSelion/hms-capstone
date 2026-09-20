<?php

namespace App\Mail;

use App\Models\Reservation;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class RefundRejectedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Reservation $reservation,
        public string $reason,
        public string $hotelName = 'Pampanga Home Suites',
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Refund Request Update — {$this->reservation->reservation_number}",
        );
    }

    public function build(): self
    {
        return $this->replyTo('pampangahomesuites.noreply@gmail.com');
    }

    public function content(): Content
    {
        return new Content(
            htmlString: $this->buildHtml(),
        );
    }

    private function buildHtml(): string
    {
        $guest = $this->reservation->guest;
        $name = e($guest->first_name ?? 'Guest');
        $hotel = e($this->hotelName);
        $bookingRef = e($this->reservation->reservation_number);
        $reason = nl2br(e($this->reason));
        $year = date('Y');

        return <<<HTML
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#12233A;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#12233A;padding:40px 20px;">
    <tr><td align="center">
      <table width="500" cellpadding="0" cellspacing="0" style="background-color:#1a2d47;border-radius:16px;overflow:hidden;border:1px solid rgba(192,160,98,0.15);">
        <!-- Header -->
        <tr><td style="padding:40px 40px 20px;text-align:center;">
          <div style="font-size:24px;font-weight:300;letter-spacing:2px;color:#C0A062;font-family:Georgia,serif;">{$hotel}</div>
          <div style="width:40px;height:2px;background:#C0A062;margin:16px auto 0;border-radius:1px;"></div>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:20px 40px;">
          <h2 style="color:#ffffff;font-size:20px;font-weight:400;margin:0 0 12px;text-align:center;">Refund Request Update</h2>
          <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.6;margin:0 0 8px;text-align:center;">
            Hi {$name},
          </p>
          <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.6;margin:0 0 20px;text-align:center;">
            We've reviewed your refund request for booking <strong style="color:rgba(255,255,255,0.8);">{$bookingRef}</strong>.
          </p>
          <!-- Rejection Details -->
          <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:12px;padding:24px;margin:0 0 20px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="color:rgba(255,255,255,0.5);font-size:13px;padding:4px 0;">Status</td>
                <td style="color:#ef4444;font-size:14px;font-weight:600;text-align:right;padding:4px 0;">Not Approved</td>
              </tr>
              <tr>
                <td style="color:rgba(255,255,255,0.5);font-size:13px;padding:4px 0;">Booking Reference</td>
                <td style="color:rgba(255,255,255,0.8);font-size:13px;text-align:right;padding:4px 0;">{$bookingRef}</td>
              </tr>
              <tr>
                <td style="color:rgba(255,255,255,0.5);font-size:13px;padding:4px 0;">Reason</td>
                <td style="color:rgba(255,255,255,0.8);font-size:13px;text-align:right;padding:4px 0;">{$reason}</td>
              </tr>
            </table>
          </div>
          <p style="color:rgba(255,255,255,0.5);font-size:13px;text-align:center;margin:0 0 8px;">
            If you believe this was an error or need further assistance, please contact our support team.
          </p>
          <p style="color:rgba(255,255,255,0.4);font-size:13px;text-align:center;margin:0;">
            Email us at info@pampangahomesuites.com or call +63 912 345 6789.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 40px 30px;border-top:1px solid rgba(255,255,255,0.05);">
          <p style="color:rgba(255,255,255,0.25);font-size:11px;text-align:center;margin:0;">
            &copy; {$year} {$hotel}. All rights reserved.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
HTML;
    }
}
