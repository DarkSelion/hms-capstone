<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#0F172A;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0F172A;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background-color:#1a2d47;border-radius:16px;overflow:hidden;border:1px solid rgba(192,160,98,0.15);">

        {{-- Header --}}
        <tr><td style="padding:40px 40px 20px;text-align:center;">
          <div style="font-size:24px;font-weight:300;letter-spacing:2px;color:#C0A062;font-family:Georgia,serif;">{{ $hotelName }}</div>
          <div style="width:40px;height:2px;background:#C0A062;margin:16px auto 0;border-radius:1px;"></div>
        </td></tr>

        <tr><td style="padding:20px 40px;">

          {{-- Heading --}}
          <h2 style="color:#ffffff;font-size:20px;font-weight:400;margin:0 0 8px;text-align:center;">Booking Confirmed!</h2>
          <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.6;margin:0 0 24px;text-align:center;">
            Your reservation has been successfully booked. We look forward to hosting you!
          </p>

          {{-- Booking Reference --}}
          <div style="background:rgba(192,160,98,0.1);border:1px solid rgba(192,160,98,0.2);border-radius:12px;padding:16px;text-align:center;margin:0 0 24px;">
            <p style="color:rgba(255,255,255,0.4);font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0 0 6px;">Booking Reference</p>
            <div style="font-size:22px;font-weight:700;letter-spacing:3px;color:#C0A062;font-family:'Courier New',monospace;">{{ $bookingRef }}</div>
          </div>

          {{-- Details --}}
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr><td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="color:rgba(255,255,255,0.4);font-size:12px;">Room</span><br>
              <span style="color:#ffffff;font-size:14px;">{{ $roomName }} &mdash; Room {{ $roomNumber }}</span>
            </td></tr>
            <tr><td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="color:rgba(255,255,255,0.4);font-size:12px;">Check-in</span><br>
              <span style="color:#ffffff;font-size:14px;">{{ $checkIn }}</span>
            </td></tr>
            <tr><td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="color:rgba(255,255,255,0.4);font-size:12px;">Check-out</span><br>
              <span style="color:#ffffff;font-size:14px;">{{ $checkOut }}</span>
            </td></tr>
            <tr><td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="color:rgba(255,255,255,0.4);font-size:12px;">Duration</span><br>
              <span style="color:#ffffff;font-size:14px;">{{ $nightsText }}</span>
            </td></tr>
            <tr><td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="color:rgba(255,255,255,0.4);font-size:12px;">Guests</span><br>
              <span style="color:#ffffff;font-size:14px;">{{ $guests }}</span>
            </td></tr>
            <tr><td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="color:rgba(255,255,255,0.4);font-size:12px;">Total Amount</span><br>
              <span style="color:#C0A062;font-size:18px;font-weight:600;">{{ $currency }}{{ $total }}</span>
            </td></tr>
          </table>

          {{-- Payment Status Callout --}}
          @if($reservation->payment_status === 'unpaid')
            <div style="background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.3);border-radius:10px;padding:14px 16px;margin:0 0 24px;">
              <p style="color:#FBBF24;font-size:13px;font-weight:600;margin:0 0 4px;">&#9888; Payment Status: Unpaid</p>
              <p style="color:rgba(255,255,255,0.5);font-size:12px;margin:0;">
                Please settle payment by <strong style="color:#FBBF24;">{{ $effectiveDeadline->format('M j, Y \a\t g:i A') }}</strong> to avoid auto-cancellation.
              </p>
            </div>
          @elseif($reservation->payment_status === 'paid')
            <div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:10px;padding:14px 16px;margin:0 0 24px;text-align:center;">
              <span style="display:inline-block;background:rgba(34,197,94,0.15);color:#22C55E;font-size:12px;font-weight:600;padding:4px 14px;border-radius:20px;">&#10003; Payment Status: Fully Paid</span>
            </div>
          @else
            <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:14px 16px;margin:0 0 24px;text-align:center;">
              <span style="color:rgba(255,255,255,0.6);font-size:12px;font-weight:500;">Payment Status: {{ ucwords($reservation->payment_status) }}</span>
            </div>
          @endif

          {{-- Cancellation Policy --}}
          <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:14px 16px;margin:0 0 24px;">
            <p style="color:rgba(255,255,255,0.4);font-size:11px;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 6px;">Cancellation Policy</p>
            @if($reservation->cancellation_tier === 'non_refundable')
              <p style="color:rgba(255,255,255,0.6);font-size:13px;margin:0;">Non-refundable rate &mdash; no changes or refunds.</p>
            @elseif($reservation->payment_status === 'paid')
              <p style="color:rgba(255,255,255,0.6);font-size:13px;margin:0;">Free cancellation up to 24 hours before check-in.</p>
            @else
              <p style="color:rgba(255,255,255,0.6);font-size:13px;margin:0;">Unpaid reservations are automatically released if payment is not received by the deadline above.</p>
            @endif
          </div>

          {{-- CTA --}}
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;"><tr><td align="center">
            <table cellpadding="0" cellspacing="0" role="presentation"><tr>
              <td style="background-color:#f59e0b;border-radius:8px;box-shadow:0 4px 14px rgba(245,158,11,0.25);">
                <a href="https://pampangahomesuites.duckdns.org/public/my-reservations"
                   style="display:block;padding:14px 24px;font-weight:700;font-size:14px;color:#0f172a;text-decoration:none;letter-spacing:0.025em;">View Booking &amp; Payment Options &rarr;</a>
              </td>
            </tr></table>
          </td></tr></table>

        </td></tr>

        {{-- Footer --}}
        <tr><td style="padding:20px 40px 30px;border-top:1px solid rgba(255,255,255,0.05);text-align:center;">
          <p style="color:rgba(255,255,255,0.35);font-size:11px;margin:0 0 4px;">{{ $hotelAddress }} | {{ $hotelPhone }} | {{ $hotelEmail }}</p>
          <p style="color:rgba(255,255,255,0.25);font-size:11px;margin:0;">&copy; {{ $year }} {{ $hotelName }}. All rights reserved.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
