<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class InquiryReplyMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $recipientName,
        public string $inquirySubject,
        public string $replyBody,
        public string $hotelName = 'Pampanga Home Suites',
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Re: {$this->inquirySubject}",
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
        $name = e($this->recipientName);
        $hotel = e($this->hotelName);
        $body = nl2br(e($this->replyBody));
        $subject = e($this->inquirySubject);
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
          <h2 style="color:#ffffff;font-size:20px;font-weight:400;margin:0 0 12px;text-align:center;">Reply to Your Inquiry</h2>
          <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.6;margin:0 0 8px;text-align:center;">
            Hi {$name},
          </p>
          <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.6;margin:0 0 20px;text-align:center;">
            Thank you for reaching out to us. Here is our reply regarding <strong style="color:rgba(255,255,255,0.8);">{$subject}</strong>:
          </p>
          <div style="background:rgba(192,160,98,0.08);border:1px solid rgba(192,160,98,0.15);border-radius:12px;padding:24px;margin:0 0 20px;">
            <p style="color:rgba(255,255,255,0.8);font-size:14px;line-height:1.7;margin:0;white-space:pre-wrap;">{$body}</p>
          </div>
          <p style="color:rgba(255,255,255,0.4);font-size:13px;text-align:center;margin:0 0 8px;">
            If you have further questions, feel free to reply to this email or visit our website.
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
