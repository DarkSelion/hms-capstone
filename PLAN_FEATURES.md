# FEATURE PLAN — 9 Tasks for Second Device

## Setup
```bash
cd /path/to/hotel_2
git pull origin master    # Get latest
```

---

## TASK 1: Auto-Approve Reviews (5 min)

### `backend/app/Http/Controllers/api/ReviewController.php`

Line 52: Change `'is_approved' => false` → `'is_approved' => true`

After `Review::create(...)`, add:
```php
$review->approve();
```

### `frontend/src/pages/public/PublicWriteReviewPage.tsx`

Line 31: Change success toast to:
```tsx
addToast('Your review has been published!', 'success')
```

Line 81: Change confirmation text to:
```tsx
<p className="text-sm text-muted">Your review is now live on the room page.</p>
```

---

## TASK 2: Booking Confirmation Email (15 min)

### Create `backend/app/Mail/BookingConfirmationMail.php`

```php
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
        if ($r->children > 0) $guests .= ', ' . $r->children . ' child' . ($r->children > 1 ? 'ren' : '');
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
```

### `backend/app/Http/Controllers/Api/Public/ReservationController.php`

Add imports at top:
```php
use App\Mail\BookingConfirmationMail;
use Illuminate\Support\Facades\Mail;
```

After line 166 (after ActivityLog::create, before return), add:
```php
try {
    Mail::to($guest->email)->send(new BookingConfirmationMail($reservation));
} catch (\Exception $e) {
    // Don't fail the booking if email fails
}
```

---

## TASK 3: Toast Notification Redesign (15 min)

### `frontend/src/components/ui/toast.tsx` — Full rewrite

```tsx
import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

type ToastVariant = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: number
  message: string
  variant: ToastVariant
  duration: number
}

interface ToastContextType {
  addToast: (message: string, variant: ToastVariant, duration?: number) => void
}

const DEFAULT_DURATION = 4000
const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const iconColor = {
  success: 'text-emerald-500',
  error: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
}

const progressColor = {
  success: 'bg-emerald-500',
  error: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const Icon = iconMap[toast.variant]
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    const start = Date.now()
    const tick = () => {
      const elapsed = Date.now() - start
      const pct = Math.max(0, 100 - (elapsed / toast.duration) * 100)
      setProgress(pct)
      if (pct > 0) requestAnimationFrame(tick)
    }
    const raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [toast.duration])

  useEffect(() => {
    const timer = setTimeout(() => onClose(), toast.duration)
    return () => clearTimeout(timer)
  }, [toast.duration, onClose])

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white shadow-xl shadow-black/10 animate-slide-in-right border border-gray-100 w-full sm:w-[360px]">
      <div className="flex items-start gap-3 p-4">
        <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', iconColor[toast.variant])} />
        <p className="flex-1 text-sm text-gray-800 leading-relaxed">{toast.message}</p>
        <button onClick={onClose} className="shrink-0 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="h-0.5 bg-gray-100">
        <div
          className={cn('h-full transition-none rounded-full', progressColor[toast.variant])}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, variant: ToastVariant, duration: number = DEFAULT_DURATION) => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, variant, duration }])
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-sm:left-4 max-sm:right-4 max-sm:bottom-4">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
```

### `frontend/src/index.css` — Update animation

Replace the `slide-in-right` keyframes:
```css
@keyframes slide-in-right {
  from { opacity: 0; transform: translateX(20px) scale(0.95); }
  to { opacity: 1; transform: translateX(0) scale(1); }
}
```

---

## TASK 4: My Reservations Dark Theme (30 min)

### `frontend/src/pages/public/PublicMyReservationsPage.tsx`

Systematic find-and-replace across the file:

**Body section:**
- `bg-cream py-16 px-4` → `bg-dark py-10 sm:py-12 px-4`

**StatTile (lines 618-638):**
- `bg-white border` → `bg-white/[0.06] border`
- `border-gray-200` → `border-white/[0.08]`
- `text-dark/40` → `text-white/40`
- `text-dark` (value) → `text-white`
- `text-dark/40` (sublabel) → `text-white/40`

**Filter tabs (lines 364-379):**
- Active: `bg-gold text-dark shadow-md shadow-gold/20` (stays same)
- Inactive: `bg-white border border-gray-100 text-dark/40 hover:border-gold/30` → `bg-white/[0.06] border border-white/[0.08] text-white/50 hover:border-gold/30 hover:text-white/70`

**Search input:**
- `bg-white border border-gray-200 text-dark` → `bg-white/[0.06] border border-white/[0.08] text-white placeholder:text-white/30`

**ReservationCard (lines 679-765):**
- `bg-white` → `bg-white/[0.06]`
- `border-white/90` → `border-white/[0.08]`
- `border-gray-100` → `border-white/[0.04]`
- `hover:border-gray-200` → `hover:border-white/[0.08]`
- `from-gray-200 via-gray-100` → `from-white/10 via-white/5`
- `text-dark/30` → `text-white/30`
- `text-dark` (ref number) → `text-white`
- `text-dark` (room name) → `text-white`
- `text-dark/50` (room location) → `text-white/50`
- `bg-amber-50 border-amber-200 text-amber-800` → `bg-amber-500/10 border-amber-500/20 text-amber-300`
- `text-dark/40` (bed type) → `text-white/40`
- `bg-dark/5` → `bg-white/5`
- `bg-emerald-50 border-emerald-200 text-emerald-700` → `bg-emerald-500/10 border-emerald-500/20 text-emerald-300`
- `bg-dark/5` (image column) → `bg-white/5`
- `border-gray-100` → `border-white/[0.06]`

**MetaCell (lines 870-879):**
- `bg-bg border border-border` → `bg-white/[0.04] border border-white/[0.06]`
- `text-dark` → `text-white`
- `text-dark/55` → `text-white/55`

**EmptyState (lines 882-903):**
- `bg-white border-white/90` → `bg-white/[0.06] border-white/[0.08]`
- `text-dark` → `text-white`
- `text-dark/50` → `text-white/50`

**FilteredEmpty (lines 906-924):**
- Same pattern as EmptyState

**ReservationDetailsModal:**
- Keep as white (uses Modal component) but improve info cell contrast
- `bg-bg` → `bg-gray-50`

---

## TASK 5: Booking Wizard Step 1 Redesign (15 min)

### `frontend/src/pages/public/PublicBookingPage.tsx`

Replace lines 304-374 (the `{step === 1 && (` block):

```tsx
{step === 1 && (
  <div className="animate-fade-in max-w-2xl mx-auto">
    <div className="text-center mb-10">
      <div className="inline-flex items-center gap-2 bg-gold/10 border border-gold/20 rounded-full px-4 py-1.5 mb-4">
        <span className="text-[10px] uppercase tracking-[0.2em] text-gold font-semibold">Step 1 of 3</span>
      </div>
      <h1 className="font-serif text-white text-3xl sm:text-4xl font-light mb-3">Select Your Dates</h1>
      <p className="text-white/40 text-sm">Choose your stay dates and guest count to see available rooms.</p>
    </div>
    <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl p-6 sm:p-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="text-xs uppercase tracking-[0.15em] text-gold/50 block mb-2">Check In</label>
          <DatePicker value={checkIn} onChange={(v) => setCheckIn(v)} min={toLocalDateStr(new Date())} max={maxDate} />
        </div>
        <div>
          <label className="text-xs uppercase tracking-[0.15em] text-gold/50 block mb-2">Check Out</label>
          <DatePicker value={checkOut} onChange={(v) => setCheckOut(v)} min={minCheckOut} max={maxDate} />
        </div>
        <div>
          <label className="text-xs uppercase tracking-[0.15em] text-white/40 block mb-2">Adults</label>
          <select value={adultsSafe} onChange={(e) => setAdults(Number(e.target.value))} className="input-public">
            {Array.from({ length: maxAdults }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-[0.15em] text-white/40 block mb-2">Children</label>
          <select value={childrenSafe} onChange={(e) => setChildrenCount(Number(e.target.value))} className="input-public">
            {Array.from({ length: maxChildren + 1 }, (_, i) => i).map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>
      {datesValid && (
        <div className="mt-5 bg-gold/5 border border-gold/15 rounded-xl p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-gold/10 flex items-center justify-center shrink-0">
            <Calendar className="h-5 w-5 text-gold" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white/80 text-sm font-medium truncate">
              {formatDate(checkIn)} — {formatDate(checkOut)}
            </p>
            <p className="text-white/30 text-xs mt-0.5">{nights} night{nights > 1 ? 's' : ''} · {adultsSafe} adult{adultsSafe > 1 ? 's' : ''}{childrenSafe > 0 ? `, ${childrenSafe} child${childrenSafe > 1 ? 'ren' : ''}` : ''}</p>
          </div>
          <span className="bg-gold/15 text-gold text-xs font-semibold px-2.5 py-1 rounded-full">{nights}N</span>
        </div>
      )}
      {dateError && <p className="mt-4 text-sm text-red-400">{dateError}</p>}
      <button onClick={() => setStep(2)} disabled={!datesValid} className="btn-gold w-full mt-6 flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed">
        Search Available Rooms <ChevronRight className="h-4 w-4" />
      </button>
    </div>
    <div className="flex items-center justify-center gap-6 mt-8">
      {[
        { icon: '🔒', label: 'Secure Booking' },
        { icon: '✨', label: 'Best Price Guarantee' },
        { icon: '🏊', label: 'Free Pool Access' },
      ].map((b) => (
        <div key={b.label} className="flex items-center gap-1.5 text-white/25 text-xs">
          <span className="text-sm">{b.icon}</span> {b.label}
        </div>
      ))}
    </div>
  </div>
)}
```

---

## TASK 6: Phone Input Redesign (10 min)

### `frontend/src/pages/public/PublicRegisterPage.tsx`

Replace phone field (lines 110-114):
```tsx
<div>
  <label htmlFor="reg_phone" className="text-xs uppercase tracking-[0.15em] text-white/40 block mb-2">Phone Number</label>
  <div className="relative">
    <span className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-white/40 text-sm border-r border-white/10 pr-2.5">
      <span className="text-xs">🇵🇭</span> +63
    </span>
    <input
      id="reg_phone"
      type="tel"
      value={form.phone}
      onChange={(e) => update('phone', stripPhoneInput(e.target.value))}
      required
      className="input-public pl-[4.2rem]"
      placeholder="917 123 4567"
      maxLength={15}
      pattern="(\+63\s?|0)\d{8,13}"
    />
  </div>
  <p className="text-[10px] text-white/20 mt-1.5">Format: 09XX XXX XXXX or +63 9XX XXX XXXX</p>
</div>
```

### `backend/app/Http/Controllers/Api/Public/AuthController.php`

Line 24: Update phone regex:
```php
'phone' => ['required', 'string', 'max:20', 'regex:/^(\+63|0)\d{9,13}$/'],
```

---

## TASK 7: Write a Review Redesign (15 min)

### `frontend/src/pages/public/PublicWriteReviewPage.tsx` — Full rewrite

See the full code in the plan conversation. Key changes:
- Dark themed (`bg-dark`)
- Larger interactive stars (10-12 size) with glow effect
- Sentiment chips (emoji + label)
- Better success state

---

## TASK 8: Modal Scroll Fix

### `frontend/src/components/ui/modal.tsx`

Line 40: `document.body.style.overflow = 'unset'` → `document.body.style.overflow = ''`

---

## Deploy

```bash
bash deploy.sh
```

Or manually:
```bash
# Backend files
scp -i hotel-v2.pem backend/app/Mail/BookingConfirmationMail.php ubuntu@3.80.68.104:/tmp/
scp -i hotel-v2.pem backend/app/Http/Controllers/Api/Public/ReservationController.php ubuntu@3.80.68.104:/tmp/
scp -i hotel-v2.pem backend/app/Http/Controllers/Api/ReviewController.php ubuntu@3.80.68.104:/tmp/
ssh -i hotel-v2.pem ubuntu@3.80.68.104 "sudo cp /tmp/BookingConfirmationMail.php /var/www/hotel/backend/app/Mail/; sudo cp /tmp/ReservationController.php /var/www/hotel/backend/app/Http/Controllers/Api/Public/; sudo cp /tmp/ReviewController.php /var/www/hotel/backend/app/Http/Controllers/Api/; sudo chown -R www-data:www-data /var/www/hotel/backend/app/Mail /var/www/hotel/backend/app/Http/Controllers/Api"

# Frontend
npm run build
tar -czf /tmp/hotel-dist.tar.gz -C frontend/dist .
scp -i hotel-v2.pem /tmp/hotel-dist.tar.gz ubuntu@3.80.68.104:/tmp/
ssh -i hotel-v2.pem ubuntu@3.80.68.104 "sudo rm -rf /var/www/hotel/frontend/dist/* && sudo tar -xzf /tmp/hotel-dist.tar.gz -C /var/www/hotel/frontend/dist && sudo chown -R www-data:www-data /var/www/hotel/frontend/dist"
```

## Testing Checklist

| # | Test | Expected |
|---|------|----------|
| 1 | Book a room → check email | Confirmation email arrives |
| 2 | My Reservations page | All dark theme |
| 3 | Click reservation → View Details | Smooth scroll, close restores body |
| 4 | Booking wizard Step 1 | Compact header, trust badges |
| 5 | Registration phone input | +63 prefix badge |
| 6 | Any toast notification | White card + progress bar |
| 7 | Write a Review → submit | Dark theme, large stars |
| 8 | Room detail → Reviews | Shows auto-approved review |
| 9 | Duplicate review | Error message |
| 10 | `php artisan test` | 507+ passing |
| 11 | `npx vitest run` | 312+ passing |
