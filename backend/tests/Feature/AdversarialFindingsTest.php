<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Guest;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\Role;
use App\Models\Room;
use App\Models\RoomType;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Adversarial confirmation tests. Each test asserts the CORRECT/SAFE
 * behaviour — a failure here is evidence of a real bug in the product
 * code. These are intentionally NOT fixed yet (report-only session).
 */
class AdversarialFindingsTest extends TestCase
{
    use RefreshDatabase;

    protected static int $counter = 0;

    protected function admin(string $slug = 'admin'): User
    {
        $role = Role::create(['name' => ucfirst($slug), 'slug' => $slug]);

        return User::create([
            'name' => 'Admin',
            'email' => $slug.self::$counter.'@test.com',
            'password' => Hash::make('password'),
            'role_id' => $role->id,
            'is_active' => true,
        ]);
    }

    protected function guest(array $overrides = []): Guest
    {
        self::$counter++;

        return Guest::create(array_merge([
            'first_name' => 'Juan',
            'last_name' => 'Dela Cruz',
            'email' => 'juan'.self::$counter.'@example.com',
            'phone' => '0917123456'.self::$counter,
            'password' => Hash::make('password'),
        ], $overrides));
    }

    protected function roomType(): RoomType
    {
        return RoomType::create([
            'name' => 'Deluxe',
            'slug' => 'deluxe-'.(++self::$counter),
            'base_price' => 1000,
        ]);
    }

    protected function room(array $overrides = []): Room
    {
        $type = $this->roomType();

        return Room::create(array_merge([
            'room_number' => '40'.self::$counter,
            'room_type_id' => $type->id,
            'floor' => 4,
            'status' => 'available',
            'cleaning_status' => 'clean',
            'capacity' => 2,
            'is_active' => true,
        ], $overrides));
    }

    protected function reservation(?Room $room = null, array $overrides = []): Reservation
    {
        $bookingGuest = $this->guest();
        $room = $room ?? $this->room();
        $id = Reservation::max('id') ?? 0;

        return Reservation::create(array_merge([
            'reservation_number' => 'BK-2026-'.str_pad((string) ($id + 1), 4, '0', STR_PAD_LEFT),
            'guest_id' => $bookingGuest->id,
            'room_id' => $room->id,
            'status' => 'confirmed',
            'check_in' => '2026-10-10',
            'check_out' => '2026-10-12',
            'adults' => 2,
            'children' => 0,
            'price_per_night' => 1000,
            'total_nights' => 2,
            'subtotal' => 2000,
            'total_amount' => 2000,
            'due_amount' => 2000,
            'paid_amount' => 0,
            'discount_percent' => 0,
            'discount_amount' => 0,
            'tax_percent' => 0,
            'tax_amount' => 0,
            'payment_status' => 'unpaid',
            'source' => 'direct',
        ], $overrides));
    }

    // ── 1. Reservation delete must NOT cascade-delete financial records ─

    public function test_deleting_reservation_keeps_payments_and_invoices(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation();
        Payment::create([
            'reservation_id' => $reservation->id,
            'guest_id' => $reservation->guest_id,
            'amount' => 1000,
            'payment_method' => 'cash',
            'payment_type' => 'partial',
            'status' => 'completed',
            'paid_at' => now(),
        ]);
        $invoice = Invoice::create([
            'invoice_number' => 'INV-ADV-1',
            'reservation_id' => $reservation->id,
            'guest_id' => $reservation->guest_id,
            'amount' => 2000,
            'total_amount' => 2000,
            'paid_amount' => 0,
            'due_amount' => 2000,
            'status' => 'draft',
            'issued_date' => '2026-10-10',
            'due_date' => '2026-11-10',
            'created_by' => $admin->id,
        ]);

        $this->deleteJson("/api/reservations/{$reservation->id}")->assertStatus(422);

        $this->assertTrue(
            Reservation::where('id', $reservation->id)->exists(),
            'Reservation was deleted despite having financial records.'
        );
        $this->assertTrue(
            Payment::where('reservation_id', $reservation->id)->exists(),
            'Payment was cascade-deleted with the reservation.'
        );
        $this->assertTrue(
            Invoice::where('id', $invoice->id)->exists(),
            'Invoice was cascade-deleted with the reservation.'
        );
    }

    // ── 2. Staff update must respect creator tier (no escalation) ──────

    public function test_admin_cannot_promote_another_user_to_super_admin_via_update(): void
    {
        $admin = $this->admin('admin');
        Sanctum::actingAs($admin);

        $target = $this->admin('receptionist');
        $superAdminRole = Role::where('slug', 'super_admin')->first()
            ?? Role::create(['name' => 'Super Admin', 'slug' => 'super_admin']);

        $response = $this->putJson("/api/staff/{$target->id}", [
            'role_id' => $superAdminRole->id,
        ]);

        $this->assertTrue(
            in_array($response->status(), [403, 422]),
            'Admin was allowed to promote a staff member to super_admin (status '.$response->status().').'
        );
        $this->assertNotSame($superAdminRole->id, $target->fresh()->role_id, 'Target was escalated to super_admin.');
    }

    public function test_hotel_manager_cannot_promote_another_user_to_admin_via_update(): void
    {
        $manager = $this->admin('hotel_manager');
        Sanctum::actingAs($manager);

        $target = $this->admin('receptionist');
        $adminRole = Role::where('slug', 'admin')->first()
            ?? Role::create(['name' => 'Admin', 'slug' => 'admin']);

        $response = $this->putJson("/api/staff/{$target->id}", [
            'role_id' => $adminRole->id,
        ]);

        $this->assertTrue(
            in_array($response->status(), [403, 422]),
            'Hotel manager was allowed to promote a staff member to admin (status '.$response->status().').'
        );
    }

    // ── 3. Webhook dedupe must key on transaction, not (reservation, amount) ─

    public function test_two_equal_partial_payments_via_webhook_both_recorded(): void
    {
        Setting::updateOrCreate(['key' => 'online_gateway_webhook_secret'], ['value' => 'webhook-secret-abc', 'group' => 'payment']);

        $reservation = $this->reservation();
        $ref = $reservation->reservation_number;
        $headers = ['X-Webhook-Secret' => 'webhook-secret-abc'];

        // Two DISTINCT gateway transactions, same amount — both must record.
        $this->postJson('/api/webhooks/payment', ['booking_ref' => $ref, 'status' => 'paid', 'amount_paid' => 500, 'transaction_id' => 'GTX-001'], $headers)->assertOk();
        $this->postJson('/api/webhooks/payment', ['booking_ref' => $ref, 'status' => 'paid', 'amount_paid' => 500, 'transaction_id' => 'GTX-002'], $headers)->assertOk();

        $count = Payment::where('reservation_id', $reservation->id)->where('status', 'completed')->count();

        $this->assertSame(2, $count, "Second identical partial payment was dropped as duplicate (count={$count}).");
    }

    public function test_webhook_replay_with_same_transaction_id_is_deduped(): void
    {
        Setting::updateOrCreate(['key' => 'online_gateway_webhook_secret'], ['value' => 'webhook-secret-abc', 'group' => 'payment']);

        $reservation = $this->reservation();
        $ref = $reservation->reservation_number;
        $headers = ['X-Webhook-Secret' => 'webhook-secret-abc'];
        $payload = ['booking_ref' => $ref, 'status' => 'paid', 'amount_paid' => 500, 'transaction_id' => 'GTX-001'];

        $this->postJson('/api/webhooks/payment', $payload, $headers)->assertOk();
        $this->postJson('/api/webhooks/payment', $payload, $headers)->assertOk();

        $count = Payment::where('reservation_id', $reservation->id)->where('status', 'completed')->count();

        $this->assertSame(1, $count, "A replayed webhook with the same transaction_id recorded a second payment (count={$count}).");
    }

    // ── 4. Same-status edit must NOT rewrite check-in/out audit timestamps ─

    public function test_editing_dates_keeps_original_checked_in_timestamp(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation(null, ['status' => 'checked_in', 'due_amount' => 0, 'total_amount' => 2000, 'paid_amount' => 2000, 'payment_status' => 'paid']);
        Payment::create([
            'reservation_id' => $reservation->id,
            'guest_id' => $reservation->guest_id,
            'amount' => 2000,
            'payment_method' => 'cash',
            'payment_type' => 'full',
            'status' => 'completed',
            'paid_at' => now(),
        ]);

        $originalCheckIn = $reservation->checked_in_at ? $reservation->checked_in_at->toDateTimeString() : null;
        $reservation->update(['checked_in_at' => now()->subDays(3), 'checked_in_by' => $admin->id]);
        $originalCheckIn = $reservation->fresh()->checked_in_at->toDateTimeString();

        $this->putJson("/api/reservations/{$reservation->id}", [
            'status' => 'checked_in',
            'check_in' => '2026-10-11',
            'check_out' => '2026-10-13',
            'adults' => 2,
            'children' => 0,
        ])->assertOk();

        $newCheckIn = $reservation->fresh()->checked_in_at->toDateTimeString();

        $this->assertSame($originalCheckIn, $newCheckIn, 'Same-status edit rewrote the checked_in_at audit timestamp.');
    }

    // ── 5. Explicit null for non-nullable columns must not 500 ─────────

    public function test_update_rejects_explicit_null_children_gracefully(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation();

        $response = $this->putJson("/api/reservations/{$reservation->id}", [
            'children' => null,
        ]);

        $this->assertTrue(
            in_array($response->status(), [200, 422]),
            "Explicit null children caused a {$response->status()} (unhandled 500 expected to be absent)."
        );
        $this->assertDatabaseHas('reservations', ['id' => $reservation->id, 'children' => 0]);
    }

    // ── 6. Check-out extending past another booking must be blocked ────

    public function test_checkout_cannot_extend_past_an_overlapping_booking(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $room = $this->room();
        // Fund generously so the settlement gate passes and the ONLY possible
        // blocker is the missing overlap re-check.
        $current = $this->reservation($room, ['status' => 'checked_in', 'due_amount' => 0, 'total_amount' => 6000, 'paid_amount' => 6000, 'payment_status' => 'paid']);
        Payment::create([
            'reservation_id' => $current->id,
            'guest_id' => $current->guest_id,
            'amount' => 6000,
            'payment_method' => 'cash',
            'payment_type' => 'full',
            'status' => 'completed',
            'paid_at' => now(),
        ]);
        // Another guest already booked the same room right after.
        $this->reservation($room, ['check_in' => '2026-10-13', 'check_out' => '2026-10-15', 'status' => 'confirmed']);

        // Try to check out while extending departure past the next booking's check-in.
        $response = $this->postJson("/api/reservations/{$current->id}/check-out", [
            'actual_check_out' => '2026-10-14',
        ]);

        $this->assertTrue(
            in_array($response->status(), [422, 409]),
            "Check-out extended past an overlapping booking was allowed (status {$response->status()})."
        );
    }

    // ── 7. Report ADR must be revenue per room-night, not per booking ──

    public function test_revenue_report_adr_matches_revenue_per_occupied_room_night(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $today = now()->toDateString();

        // Two reservations occupying TWO distinct rooms on the queried day.
        // Revenue = 6000 on that day, occupied room-nights = 2,
        // so ADR must be 3000 (= revenue / room-nights), never revenue.
        $roomA = $this->room();
        $roomB = $this->room();
        $this->reservation($roomA, ['check_in' => $today, 'check_out' => now()->addDays(1)->toDateString()]);
        $reservation = $this->reservation($roomB, ['check_in' => $today, 'check_out' => now()->addDays(2)->toDateString(), 'total_amount' => 6000]);
        Payment::create([
            'reservation_id' => $reservation->id,
            'guest_id' => $reservation->guest_id,
            'amount' => 6000,
            'payment_method' => 'cash',
            'payment_type' => 'full',
            'status' => 'completed',
            'paid_at' => now(),
        ]);

        $data = $this->getJson('/api/reports/revenue?from='.$today.'&to='.$today)
            ->assertOk()
            ->json();

        $row = $data[0];
        $adr = (float) $row['adr'];
        $revenue = (float) $row['revenue'];

        // ADR must be revenue / occupied room-nights (2), NOT revenue / 1.
        $this->assertSame(3000.0, $adr, "ADR ({$adr}) is not revenue-per-room-night (revenue={$revenue}, occupied=2).");
    }

    // ── 8. Blacklisted guest must be blocked per-request, not only at login ─

    public function test_blacklisted_guest_is_blocked_from_portal_routes(): void
    {
        Setting::updateOrCreate(['key' => 'online_gateway_webhook_secret'], ['value' => 'webhook-secret-abc', 'group' => 'payment']);

        $guest = $this->guest(['is_blacklisted' => true]);
        $this->reservation();
        Sanctum::actingAs($guest);

        $this->getJson('/api/public/reservations')
            ->assertStatus(403)
            ->assertJsonPath('message', 'Your account has been blacklisted. Contact the hotel for assistance.');
    }

    // ── 9. Payments must not be recorded on dead reservation statuses ──

    public function test_payment_rejected_on_cancelled_reservation(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $reservation = $this->reservation(null, ['status' => 'cancelled']);

        $response = $this->postJson('/api/payments', [
            'reservation_id' => $reservation->id,
            'amount' => 500,
            'payment_method' => 'cash',
            'payment_type' => 'partial',
        ]);

        $this->assertTrue(
            in_array($response->status(), [422, 400]),
            "A payment was recorded on a cancelled reservation (status {$response->status()})."
        );
        $this->assertDatabaseMissing('payments', ['reservation_id' => $reservation->id]);
    }

    // ── 10. Reservation list (GET) must not write rows / activity logs ──

    public function test_getting_reservations_does_not_write_activity_logs(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->reservation();
        $before = ActivityLog::count();

        $this->getJson('/api/reservations')->assertOk();

        $this->assertSame($before, ActivityLog::count(), 'GET /reservations wrote activity-log rows.');
    }
}