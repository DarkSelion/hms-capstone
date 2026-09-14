<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class SuspiciousLoginMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $user,
        public string $ip,
        public ?string $userAgent = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "⚠️ New Device Login — {$this->user->name}",
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
        $name = e($this->user->name);
        $email = e($this->user->email);
        $ip = e($this->ip);
        $device = e($this->userAgent ?? 'Unknown device');
        $time = now()->format('M d, Y \a\t h:i A');
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
          <div style="font-size:24px;font-weight:300;letter-spacing:2px;color:#C0A062;font-family:Georgia,serif;">Pampanga Home Suites</div>
          <div style="width:40px;height:2px;background:#C0A062;margin:16px auto 0;border-radius:1px;"></div>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:20px 40px;">
          <h2 style="color:#ff6b6b;font-size:20px;font-weight:400;margin:0 0 12px;text-align:center;">⚠️ New Device Login Detected</h2>
          <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.6;margin:0 0 20px;text-align:center;">
            A new login was detected on your staff account from an unrecognized device.
          </p>
          <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:20px;margin:0 0 20px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="color:rgba(255,255,255,0.4);font-size:13px;padding:6px 0;">Staff:</td>
                <td style="color:#ffffff;font-size:13px;padding:6px 0;text-align:right;">{$name} ({$email})</td>
              </tr>
              <tr>
                <td style="color:rgba(255,255,255,0.4);font-size:13px;padding:6px 0;">IP Address:</td>
                <td style="color:#C0A062;font-size:13px;padding:6px 0;text-align:right;font-family:'Courier New',monospace;">{$ip}</td>
              </tr>
              <tr>
                <td style="color:rgba(255,255,255,0.4);font-size:13px;padding:6px 0;">Device:</td>
                <td style="color:rgba(255,255,255,0.7);font-size:13px;padding:6px 0;text-align:right;max-width:280px;word-break:break-all;">{$device}</td>
              </tr>
              <tr>
                <td style="color:rgba(255,255,255,0.4);font-size:13px;padding:6px 0;">Time:</td>
                <td style="color:rgba(255,255,255,0.7);font-size:13px;padding:6px 0;text-align:right;">{$time}</td>
              </tr>
            </table>
          </div>
          <p style="color:rgba(255,255,255,0.5);font-size:13px;text-align:center;margin:0 0 8px;">
            If this was you, no action is needed — this device is now recognized.
          </p>
          <p style="color:#ff6b6b;font-size:13px;text-align:center;margin:0;font-weight:600;">
            If this was NOT you, change your password immediately and contact the administrator.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 40px 30px;border-top:1px solid rgba(255,255,255,0.05);">
          <p style="color:rgba(255,255,255,0.25);font-size:11px;text-align:center;margin:0;">
            &copy; {$year} Pampanga Home Suites. All rights reserved.
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
