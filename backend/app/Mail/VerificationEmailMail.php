<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class VerificationEmailMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $verificationUrl,
        public string $hotelName = 'Pampanga Home Suites',
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Verify your {$this->hotelName} email address",
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
        $url = e($this->verificationUrl);
        $hotel = e($this->hotelName);
        $year = date('Y');

        return <<<HTML
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#12233A;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#12233A;padding:40px 20px;">
    <tr><td align="center">
      <table width="500" cellpadding="0" cellspacing="0" style="background-color:#1a2d47;border-radius:16px;overflow:hidden;border:1px solid rgba(192,160,98,0.15);">
        <tr><td style="padding:40px 40px 20px;text-align:center;">
          <div style="font-size:24px;font-weight:300;letter-spacing:2px;color:#C0A062;font-family:Georgia,serif;">{$hotel}</div>
          <div style="width:40px;height:2px;background:#C0A062;margin:16px auto 0;border-radius:1px;"></div>
        </td></tr>
        <tr><td style="padding:20px 40px;">
          <h2 style="color:#ffffff;font-size:20px;font-weight:400;margin:0 0 12px;text-align:center;">Verify your email</h2>
          <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.6;margin:0 0 30px;text-align:center;">
            Click the button below to verify your email address and start booking:
          </p>
          <div style="text-align:center;margin:0 0 30px;">
            <a href="{$url}" style="display:inline-block;background-color:#C0A062;color:#12233A;font-size:16px;font-weight:600;text-decoration:none;padding:14px 40px;border-radius:8px;">Verify Email Address</a>
          </div>
          <p style="color:rgba(255,255,255,0.4);font-size:13px;text-align:center;margin:0 0 8px;">This link expires in <strong style="color:rgba(255,255,255,0.6);">24 hours</strong>.</p>
          <p style="color:rgba(255,255,255,0.4);font-size:13px;text-align:center;margin:0;">If you didn't create an account, you can safely ignore this email.</p>
        </td></tr>
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
