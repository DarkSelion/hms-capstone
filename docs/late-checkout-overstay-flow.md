# Late Check-Out, Overstay & Extend Stay — Complete Flow

> Pampanga Home Suites — Hotel Management System  
> Last updated: September 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Configuration](#configuration)
3. [Late Check-Out Flow (Same-Day)](#late-check-out-flow-same-day)
4. [Overstay / Extra-Night Billing](#overstay--extra-night-billing)
5. [Extend Stay Flow](#extend-stay-flow)
6. [Overstay Detection & Auto-Cancel](#overstay-detection--auto-cancel)
7. [Key Design Decisions](#key-design-decisions)
8. [Flow Diagrams](#flow-diagrams)
9. [Test Coverage](#test-coverage)
10. [File Reference](#file-reference)

---

## Overview

The system implements a **two-tier departure policy** for handling guests who depart later than their booked check-out date:

| Scenario | What happens | Fee |
|----------|-------------|-----|
| **Same-day late departure** — guest departs on the booked check-out date, but after the configured check-out time | Flat `late_checkout_fee` added to total | Configurable (e.g. ₱500) |
| **Extra-night departure** — guest departs on a later date than booked | Extra nights billed at `price_per_night` rate | Nightly rate × extra nights |

**These two paths are mutually exclusive** — the flat fee never stacks with extra-night billing.

Additionally, the system supports **Extend Stay** — a proactive way for staff to push a reservation's check-out date forward before the guest departs, with overlap checking and live pricing preview.

---

## Configuration

All settings are in **Admin → Settings → Booking tab**.

### Late Check-out Fee

- **Setting key:** `late_checkout_fee`
- **Default:** `0` (feature disabled)
- **Type:** Flat peso amount
- **Behavior:** When > 0 and the guest departs on their booked check-out date after the cutoff time, this fee is added to the total.

### Check-out Time

- **Setting key:** `check_out_time`
- **Default:** `11:00` (stored as 24h format)
- **Type:** Time selector (hour : minute AM/PM in UI, stored as `HH:MM`)
- **Behavior:** The cutoff time. Departures after this time on the booked check-out date trigger the late fee.

### Auto-Cancel Grace Hours

- **Setting key:** `auto_cancel_grace_hours`
- **Default:** `24`
- **Type:** Integer (hours after check-in date)
- **Behavior:** Unpaid confirmed reservations are auto-cancelled after this many hours past the check-in date (with a minimum 2-hour buffer from booking time).

---

## Late Check-Out Flow (Same-Day)

### When It Applies

The fee is computed by `Reservation::lateCheckoutFee()` (`backend/app/Models/Reservation.php:214-245`). Three conditions must ALL be true:

1. **Fee > 0** — The `late_checkout_fee` setting must be greater than 0. If it's 0, the feature is disabled.
2. **Same-date departure** — The current hotel-local date must equal the reservation's booked `check_out` date. If the guest is departing on a different day, extra-night billing applies instead.
3. **Past cutoff time** — The current hotel-local clock time (`H:i`) must be after the `check_out_time` setting.

If any condition fails, the fee is 0.

### Step-by-Step Flow

#### 1. Staff Opens Check-Out Modal

The frontend fetches a live preview via `GET /reservations/{id}/checkout-preview?actual_check_out=...`.

```
Frontend: useCheckoutPreview(reservationId, actualDeparture)
  → GET /api/reservations/{id}/checkout-preview?actual_check_out=2026-09-20
```

#### 2. Backend Computes Preview

`ReservationController::checkoutPreview()` (`ReservationController.php:550-591`):

```php
$projected = $reservation->projectedCheckoutTotal($actualCheckOut);
return response()->json([
    'total_amount' => $projected['total_amount'],
    'due_amount' => $projected['due_amount'],
    'late_checkout_fee' => $projected['late_checkout_fee'],
    'late_checkout_applies' => $projected['late_checkout_applies'],
    // ... other fields
]);
```

`Reservation::projectedCheckoutTotal()` (`Reservation.php:268-295`):

```php
$lateFee = $actualCheckOut === $this->check_out->toDateString()
    ? $this->lateCheckoutFee()    // Same-day → compute fee
    : 0.0;                        // Different day → no flat fee

$total = round((float) $pricing['total_amount'] + $lateFee, 2);
```

#### 3. Frontend Displays Late Fee Notice

`ReservationCheckInOutModal.tsx` (lines 450-462):

When `late_checkout_applies` is `true`, an amber warning card appears:

```
⚠ Late check-out fee: ₱500.00
  The guest is departing after the check-out time. The fee has been added to the total.
```

The fee is already folded into `total_amount` / `due_amount` shown in the Billing card and "Balance Due" hero box.

#### 4. Staff Collects Payment

If there's a balance (including the late fee), `PaymentModal` opens. The staff collects the payment.

#### 5. Staff Clicks "Check Out"

`handleConfirm()` sends `POST /reservations/{id}/check-out` with `{ actual_check_out }`.

#### 6. Backend Executes Check-Out

`ReservationController::checkOut()` (`ReservationController.php:439-548`) runs everything in **ONE `DB::transaction`**:

| Step | Code | What Happens |
|------|------|-------------|
| 1. Room lock | `Room::whereKey(...)->lockForUpdate()` | Serializes concurrent check-outs |
| 2. Overlap re-check | `roomHasOverlap()` | If dates changed, blocks on collision |
| 3. Late fee calc | `$lateFee = $datesChanged ? 0 : $reservation->lateCheckoutFee()` | Same-day only |
| 4. Balance projection | `$projectedDue = total + lateFee - paid` | Computes remaining balance |
| 5. Settlement gate | `if ($projectedDue > 0) return ['blocked' => 'balance']` | **422 if unpaid** |
| 6. Late fee fold | `$total_amount = base + lateFee` (absolute, not `+=`) | Prevents double-charge on retry |
| 7. Reconcile | `$reservation->reconcileBalances()` | Updates paid/due/payment_status |
| 8. Status change | `status = 'checked_out'`, timestamps | Marks complete |
| 9. Room freed | `room.status = 'dirty'`, `cleaning_status = 'dirty'` | Ready for housekeeping |

#### 7. Activity Logs

Outside the transaction:

- If `$lateFee > 0`: `action = 'late_checkout'` — "Charged late check-out fee of ₱500.00 for reservation #BK-..."
- Always: `action = 'checked_out'` — "Checked out reservation #BK-..."

---

## Overstay / Extra-Night Billing

### When It Applies

When the guest departs on a **later date** than the booked check-out (not the same day), the system bills extra nights instead of a flat fee.

### Step-by-Step Flow

#### 1. Staff Sets Actual Departure

In the check-out modal, the staff changes the "Actual departure" date to a later date than the booked check-out.

#### 2. Preview Recalculates

The `useCheckoutPreview` hook fires with the new date. `projectedCheckoutTotal()` calls `computePricing($actualCheckOut)` which calculates:

```php
$nights = max(1, check_in->diffInDays(checkOutDate));
$subtotal = $rate * $nights;
$discount = $subtotal * ($discountPercent / 100);
$tax = ($subtotal - $discount) * $taxRate;
$total = $subtotal - $discount + $tax;
```

The late fee is 0 (because dates changed), so the total reflects only the extra nights.

#### 3. UI Shows Breakdown

The modal shows a live breakdown:
- Nights: 3 → 5 (+2)
- New Total: ₱3,750.00
- Extra Charge: +₱2,500.00
- Amount Due After: ₱1,250.00

#### 4. Check-Out Execution

Inside `checkOut()`:

```php
$datesChanged = $actualCheckOut !== $reservation->check_out->toDateString();
$lateFee = $datesChanged ? 0.0 : $reservation->lateCheckoutFee();  // 0 for overstay
$currentTotal = $reservation->computePricing($actualCheckOut)['total_amount'];
```

The settlement gate blocks if `projectedDue > 0`. If settled:

```php
$reservation->update(['check_out' => $actualCheckOut]);
$this->recalculatePricing($reservation);  // recomputes all financial fields
```

`recalculatePricing()` (`ReservationController.php:750-764`):

```php
$pricing = $reservation->computePricing($reservation->check_out->toDateString());
$reservation->update([
    'total_nights' => $pricing['nights'],
    'subtotal' => $pricing['subtotal'],
    'discount_amount' => $pricing['discount_amount'],
    'tax_percent' => $pricing['tax_percent'],
    'tax_amount' => $pricing['tax_amount'],
    'total_amount' => $pricing['total_amount'],
]);
$reservation->reconcileBalances();
```

---

## Extend Stay Flow

### When It Can Be Used

- Only for **checked-in** reservations
- The new check-out date must be **strictly after** the current check-out date

### Where It's Triggered

1. **ReservationsPage** — Row actions "Extend Stay" button + Detail modal footer button
2. **CheckOutPage** — Row actions "Extend Stay" button + Detail modal footer button

### Step-by-Step Flow

#### 1. Staff Clicks "Extend Stay"

Opens `ExtendStayModal` with a date picker.

#### 2. Date Picker Constraints

- **Minimum date:** Current check-out + 1 day (can't extend to the same day)
- **No maximum:** Can extend arbitrarily far into the future

#### 3. Client-Side Preview

No API call — computed entirely on the frontend:

```typescript
const extraNights = newNights - existingNights;
const extraAmount = pricePerNight * extraNights;
const newTotal = (pricePerNight * newNights) * (1 - discountPercent/100) * (1 + taxPercent/100);
const newDue = Math.max(0, newTotal - paidAmount);
```

Shows: Nights (existing → new), New Total, Extra Charge, Amount Due After.

#### 4. Staff Confirms

```
POST /api/reservations/{id}/extend-stay
Body: { "new_check_out": "2026-09-25" }
```

#### 5. Backend Processing

`ReservationController::extendStay()` (`ReservationController.php:694-748`):

```
1. Status guard: must be checked_in → 422 otherwise
2. Validation: new_check_out must be after current check_out → 422 otherwise
3. DB transaction:
   a. Lock room row (lockForUpdate) — prevents concurrent booking/extension
   b. Overlap check — any active reservation on same room during extended period?
   c. If overlap → return 422 "room already reserved"
   d. Update check_out → new date
   e. recalculatePricing() → recompute nights/subtotal/discount/tax/total
   f. reconcileBalances() → recompute paid/due/payment_status
6. Activity log: "Extended stay for reservation #BK-... to 2026-09-25"
7. Return fresh reservation with guest + room.roomType
```

#### 6. Cache Invalidation

On success, the frontend invalidates:
- `['reservations']` — refreshes all reservation lists
- `['dashboard']` — refreshes stats
- `['guests']` — refreshes guest history

---

## Overstay Detection & Auto-Cancel

### What Is "Overdue"?

A reservation is flagged as **overdue** when:
- `status = 'confirmed'` (not checked in yet)
- `check_in < today` (the check-in date has passed)
- `is_overdue = false` (not already flagged)

This means the guest was supposed to check in but hasn't shown up.

### Detection Schedule

**Every hour:** `reservations:detect-overdue` command runs `OverdueReservationService::detectAndFlagOverdue()`:

```
1. Find: confirmed + check_in < today + is_overdue = false
2. For each:
   a. Set is_overdue = true, overdue_at = check_in date
   b. Log: flagged_overdue activity
   c. Notify admin/hotel_manager users (notified_overdue activity logs)
```

**On ReservationsPage load:** The same `detectAndFlagOverdue()` runs inline (self-healing).

**Manual refresh:** `POST /api/reservations/refresh-overdue` endpoint.

### Auto-Cancel Schedule

**Every 15 minutes:** `app:cancel-overdue-reservations` command runs `CancelOverdueReservations`.

#### Phase 1: Cancel Unpaid Overdue

Finds: `confirmed + unpaid + check_in <= today`

Dual deadline system:
- **Deadline A:** `check_in_date + grace_hours` (default 24h, configurable via `auto_cancel_grace_hours`)
- **Deadline B:** `booking_created_at + 2 hours` (minimum safety buffer for same-day/late-night bookings)
- **Effective deadline:** The LATER of the two

If `now > effective deadline`:
```
1. Set status = 'cancelled'
2. Set cancellation_reason = 'Auto-cancelled: Unpaid no-show past grace period'
3. Free the room via reconcileStatus()
4. Log: cancelled activity
5. Send AutoCancelledMail to guest
```

#### Phase 2: Mark Paid No-Shows

Finds: `confirmed + check_out < today + check_out_time has passed`

```
1. Set status = 'no_show'
2. Set is_overdue = false (status changed, no longer flagged)
3. Set cancellation_reason = 'Auto no-show: guest did not arrive before departure date'
4. Set room.status = 'dirty', cleaning_status = 'dirty'
5. Payment is RETAINED per hotel policy
```

### Frontend Overdue Indicators

| Page | Badge | Color | Condition |
|------|-------|-------|-----------|
| ReservationsPage | `AlertTriangle` + "Overdue" pill | Rose/red (`bg-rose-50 text-rose-700`) | `status === 'confirmed' && is_overdue` |
| CheckOutPage | "Overdue" pill | Rose/red | `is_overdue` |
| CheckInPage | Overdue indicator | Rose/red | `is_overdue` |
| RowActions (CheckIn) | "Mark No Show" button replaces "Check In" | Amber | `status === 'confirmed' && is_overdue` |

---

## Key Design Decisions

### 1. Late Fee vs Extra Nights Are Mutually Exclusive

```php
// In projectedCheckoutTotal():
$lateFee = $actualCheckOut === $this->check_out->toDateString()
    ? $this->lateCheckoutFee()   // Same-day: flat fee
    : 0.0;                       // Different day: extra nights, no flat fee
```

The guard ensures the two paths never stack. A guest departing on the same day after cutoff gets the flat fee. A guest departing on a later date gets extra-night billing.

### 2. Absolute-Value Fold (No Double-Charge on Retry)

```php
// In checkOut():
$reservation->update(['total_amount' => round($base + $lateFee, 2)]);
$reservation->reconcileBalances();
```

The total is set to an absolute value (`base + lateFee`), not incremented (`total += lateFee`). So a failed/retried check-out never double-charges the guest.

### 3. Everything in One DB Transaction

The entire check-out (overlap check, fee computation, payment settlement, status change, room update) runs inside `DB::transaction()`. If any step fails, the reservation is untouched.

### 4. Room-Row Lock Prevents Race Conditions

```php
Room::whereKey($reservation->room_id)->lockForUpdate()->firstOrFail();
```

A pessimistic lock on the room row serializes concurrent operations (another booking, another extend, a check-out) so the overlap check always sees committed data.

### 5. Client-Side Preview for Extend Stay, Server-Side for Check-Out

- **Extend Stay:** Preview is computed entirely on the frontend (no API call). The backend validates and persists.
- **Check-Out:** Preview goes through `checkoutPreview()` API endpoint because the late fee depends on the current server time and settings.

### 6. Settlement Gate Is Non-Negotiable

Both late fee and extra-night billing go through the settlement gate:

```php
if ($projectedDue > 0) {
    return ['blocked' => 'balance'];
    // 422 "Settle the outstanding balance before checking out."
}
```

No check-out completes with an unpaid balance. Period.

---

## Flow Diagrams

### Late Check-Out (Same-Day)

```
Guest booked: Sep 18-20
Current time: Sep 20, 1:00 PM (past 12:00 PM cutoff)

Staff opens Check-Out Modal
  │
  ├─ useCheckoutPreview fires
  │    └─ lateCheckoutFee() → ₱500 (same-date + past cutoff)
  │    └─ total = nights(₱750×2) + tax + lateFee(₱500) = ₱2,225
  │
  ├─ Amber warning: "Late check-out fee: ₱500.00"
  │
  ├─ Balance due: ₱2,225 (was ₱1,725 without fee)
  │
  ├─ Staff collects ₱2,225 via PaymentModal
  │
  └─ Staff clicks "Check Out"
       └─ checkOut() → transaction:
            ├─ lockForUpdate() on room
            ├─ lateFee = lateCheckoutFee() → ₱500
            ├─ projectedDue = ₱2,225 - ₱2,225 = ₱0 ✓
            ├─ total_amount = ₱1,725 + ₱500 = ₱2,225
            ├─ reconcileBalances() → paid, due = 0
            ├─ status = 'checked_out'
            ├─ room → 'dirty'
            └─ activity log: "Charged late check-out fee of 500.00"
```

### Overstay (Extra-Night Billing)

```
Guest booked: Sep 18-20
Actual departure: Sep 22 (2 extra nights)

Staff sets departure to Sep 22 in modal
  │
  ├─ Preview recalculates:
  │    ├─ Nights: 2 → 4 (+2)
  │    ├─ New total: ₱750 × 4 = ₱3,000 + tax
  │    ├─ Extra charge: +₱1,500
  │    └─ Due after: ₱1,500
  │
  ├─ Staff collects ₱1,500 via PaymentModal
  │
  └─ Staff clicks "Check Out"
       └─ checkOut() → transaction:
            ├─ datesChanged = true
            ├─ lateFee = 0 (not same-day)
            ├─ computePricing(Sep 22) → ₱3,000 + tax
            ├─ projectedDue = ₱3,000 - ₱1,500 = ₱0 ✓
            ├─ update check_out → Sep 22
            ├─ recalculatePricing() → total = ₱3,000
            ├─ reconcileBalances() → paid, due = 0
            ├─ status = 'checked_out'
            └─ room → 'dirty'
```

### Extend Stay

```
Guest checked in: Sep 18, booked until Sep 20
Guest wants to stay until Sep 23

Staff clicks "Extend Stay"
  │
  ├─ ExtendStayModal opens
  │    ├─ DatePicker min = Sep 21
  │    ├─ Staff picks Sep 23
  │    ├─ Client preview:
  │    │    ├─ Nights: 2 → 5 (+3)
  │    │    ├─ Extra: ₱750 × 3 = ₱2,250
  │    │    └─ New total: ₱3,750 + tax
  │    └─ Staff confirms
  │
  └─ POST /reservations/{id}/extend-stay
       └─ Backend:
            ├─ Status guard: checked_in ✓
            ├─ Validation: Sep 23 > Sep 20 ✓
            ├─ DB transaction:
            │    ├─ lockForUpdate() on room
            │    ├─ overlap check → no collision ✓
            │    ├─ update check_out → Sep 23
            │    └─ recalculatePricing() → 5 nights, ₱3,750
            └─ Activity log: "Extended stay to 2026-09-23"
```

### Overdue Detection & Auto-Cancel

```
Reservation: confirmed, check_in = Sep 18, unpaid

Sep 18, 11:00 AM (24h grace period)
  │
  ├─ reservations:detect-overdue (hourly)
  │    └─ confirmed + check_in < today → is_overdue = true
  │    └─ Notify admin users
  │
  └─ RowActions: "Check In" → "Mark No Show"

Sep 19, 11:00 AM (past grace period)
  │
  └─ app:cancel-overdue-reservations (every 15 min)
       ├─ Phase 1: confirmed + unpaid + past deadline
       │    ├─ status → 'cancelled'
       │    ├─ cancellation_reason → 'Auto-cancelled: Unpaid no-show past grace period'
       │    ├─ room → reconcileStatus() → available
       │    └─ AutoCancelledMail → guest
       │
       └─ Phase 2: confirmed + check_out < today + time passed
            ├─ status → 'no_show'
            └─ Payment RETAINED
```

---

## Test Coverage

### `LateCheckoutFeeTest.php` (8 tests)

| Test | What It Verifies |
|------|-----------------|
| `test_late_checkout_fee_applied_after_cutoff_when_settled` | Fee added to total, activity log written, balances reconciled |
| `test_late_checkout_fee_blocks_until_settled` | 422 when fee creates unpaid balance |
| `test_no_fee_before_cutoff` | No fee when current time is before the cutoff |
| `test_no_fee_when_late_checkout_fee_zero` | No fee when setting is 0 (feature disabled) |
| `test_checkout_preview_includes_late_fee` | Preview returns `late_checkout_fee` and `late_checkout_applies` |
| `test_no_late_fee_on_overnight_departure` | Overstay bills extra nights, not the flat fee |
| `test_late_fee_applied_exactly_once` | Idempotent — second attempt rejected, no double-charge |
| `test_preview_custom_date` | Preview respects custom departure date |

### `RoomTypeCapacityAlignmentTest.php`

Verifies that `max_adults === capacity` for all seeded room types (invariant check).

---

## File Reference

### Backend

| File | Key Methods/Logic |
|------|-------------------|
| `app/Models/Reservation.php:214-245` | `lateCheckoutFee()` — 3-step fee gate |
| `app/Models/Reservation.php:194-212` | `computePricing()` — nights × rate + tax |
| `app/Models/Reservation.php:268-295` | `projectedCheckoutTotal()` — preview with late fee |
| `app/Models/Reservation.php:167-182` | `reconcileBalances()` — recompute paid/due/status |
| `app/Models/Reservation.php:161-165` | `recordedPaid()` — sum completed payments + paid invoices |
| `app/Http/Controllers/Api/ReservationController.php:439-548` | `checkOut()` — full check-out with late fee / overstay |
| `app/Http/Controllers/Api/ReservationController.php:550-591` | `checkoutPreview()` — live preview endpoint |
| `app/Http/Controllers/Api/ReservationController.php:694-748` | `extendStay()` — proactive date extension |
| `app/Http/Controllers/Api/ReservationController.php:750-764` | `recalculatePricing()` — recompute all financial fields |
| `app/Http/Controllers/Api/ReservationController.php:766-773` | `roomHasOverlap()` — overlap detection with lock |
| `app/Services/OverdueReservationService.php` | `detectAndFlagOverdue()` — flags confirmed no-shows |
| `app/Console/Commands/CancelOverdueReservations.php` | Auto-cancel unpaid + mark paid no-shows |
| `app/Console/Commands/DetectOverdueReservations.php` | Wrapper command for overdue detection |
| `database/seeders/SettingsSeeder.php:24-25` | Default settings: `late_checkout_fee=0`, `check_out_time=11:00` |
| `routes/console.php:11-12` | Schedule: hourly detect, every 15 min cancel |
| `tests/Feature/LateCheckoutFeeTest.php` | 8 tests covering late fee scenarios |

### Frontend

| File | Key Components/Logic |
|------|---------------------|
| `components/shared/ReservationCheckInOutModal.tsx` | Check-out modal with late fee notice + actual departure picker |
| `components/shared/ExtendStayModal.tsx` | Extend stay modal with client-side preview |
| `components/shared/ReservationRowActions.tsx` | Extend Stay + Mark No Show row buttons |
| `components/shared/ReservationDetailModal.tsx` | Extend Stay footer button |
| `hooks/useApi.ts:149-159` | `useCheckoutPreview()` hook |
| `hooks/useApi.ts:185-196` | `useExtendStay()` hook |
| `hooks/useApi.ts:198-207` | `useRefreshOverdue()` hook |
| `pages/admin/ReservationsPage.tsx:262-283` | Stay column (stacked vertical layout) |
| `pages/admin/ReservationsPage.tsx:312-324` | Overdue badge in main table |
| `pages/admin/ReservationsPage.tsx:555-563` | Stay column in TODAY arrivals |
| `pages/admin/CheckOutPage.tsx:173-186` | Check-out column with arrived/departs |
| `pages/admin/CheckOutPage.tsx:220-231` | Overdue badge in check-out table |
| `pages/admin/SettingsPage.tsx:595-654` | Late fee + check-out time settings UI |
| `pages/admin/ActivityLogsPage.tsx:76-91` | `late_checkout` action mapping (warning badge) |
| `lib/format.ts:63-93` | `parseCheckoutTime()` / `buildCheckoutTime()` helpers |
| `types/index.ts:146-159` | `CheckoutPreview` TypeScript interface |
