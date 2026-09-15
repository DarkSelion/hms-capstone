<?php

namespace Tests\Feature;

use App\Models\Guest;
use App\Models\Reservation;
use App\Models\Review;
use App\Models\Role;
use App\Models\Room;
use App\Models\RoomType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ReviewCancellationTierTest extends TestCase
{
    use RefreshDatabase;

    protected static int $counter = 0;

    protected function admin(): User
    {
        $role = Role::create(['name' => 'Admin', 'slug' => 'admin']);
        return User::create([
            'name' => 'Admin User',
            'email' => 'admin-review-' . (++self::$counter) . '@test.com',
            'password' => Hash::make('password'),
            'role_id' => $role->id,
            'is_active' => true,
        ]);
    }

    protected function guest(): Guest
    {
        return Guest::create([
            'first_name' => 'Jane',
            'last_name' => 'Guest',
            'email' => 'jane-review-' . (++self::$counter) . '@test.com',
            'phone' => '+639171234567',
            'password' => Hash::make('password'),
        ]);
    }

    protected function roomType(string $name = 'Deluxe', float $price = 1000, float $discount = 10, int $cancelDays = 1): RoomType
    {
        return RoomType::create([
            'name' => $name,
            'slug' => 'rt-review-' . (++self::$counter),
            'base_price' => $price,
            'capacity' => 2,
            'max_adults' => 2,
            'max_children' => 1,
            'flexible_cancellation_days' => $cancelDays,
            'non_refundable_discount' => $discount,
            'is_active' => true,
        ]);
    }

    protected function room(RoomType $rt, ?string $number = null): Room
    {
        return Room::create([
            'room_number' => $number ?? ('R' . (++self::$counter)),
            'room_type_id' => $rt->id,
            'floor' => 1,
            'capacity' => $rt->capacity,
            'status' => 'available',
            'is_active' => true,
        ]);
    }

    protected function reservation(Guest $guest, Room $room, string $tier = 'flexible', string $status = 'checked_out', ?float $rate = null): Reservation
    {
        $rate = $rate ?? 1000;
        return Reservation::create([
            'reservation_number' => 'BK-REVIEW-' . (++self::$counter),
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'room_type_id' => $room->room_type_id,
            'check_in' => now()->subDays(5)->toDateString(),
            'check_out' => now()->subDays(2)->toDateString(),
            'adults' => 1,
            'children' => 0,
            'price_per_night' => $rate,
            'total_nights' => 3,
            'subtotal' => $rate * 3,
            'tax_percent' => 12,
            'tax_amount' => $rate * 3 * 0.12,
            'total_amount' => $rate * 3 * 1.12,
            'paid_amount' => 0,
            'due_amount' => $rate * 3 * 1.12,
            'payment_status' => 'unpaid',
            'status' => $status,
            'cancellation_tier' => $tier,
        ]);
    }

    // ─── Cancellation Tier Tests ──────────────────────────────────────

    public function test_room_type_has_cancellation_fields(): void
    {
        $rt = $this->roomType('Suite', 2000, 15, 3);
        $this->assertEquals(3, $rt->flexible_cancellation_days);
        $this->assertEquals(15, $rt->non_refundable_discount);
    }

    public function test_reservation_stores_cancellation_tier(): void
    {
        $guest = $this->guest();
        $rt = $this->roomType();
        $room = $this->room($rt);
        $r = $this->reservation($guest, $room, 'non_refundable');

        $this->assertEquals('non_refundable', $r->cancellation_tier);
    }

    public function test_non_refundable_reservation_cannot_be_cancelled(): void
    {
        $guest = $this->guest();
        Sanctum::actingAs($guest, ['guest']);
        $rt = $this->roomType();
        $room = $this->room($rt);
        $r = $this->reservation($guest, $room, 'non_refundable', 'confirmed');

        $response = $this->postJson("/api/public/reservations/{$r->id}/cancel");
        $response->assertStatus(422);
        $this->assertStringContainsString('non-refundable', strtolower($response->json('message')));
    }

    public function test_flexible_reservation_can_be_cancelled(): void
    {
        $guest = $this->guest();
        Sanctum::actingAs($guest, ['guest']);
        $rt = $this->roomType();
        $room = $this->room($rt);
        $r = $this->reservation($guest, $room, 'flexible', 'confirmed');

        $response = $this->postJson("/api/public/reservations/{$r->id}/cancel");
        $response->assertOk();
    }

    public function test_admin_room_type_store_accepts_cancellation_fields(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin, ['admin']);

        $response = $this->postJson('/api/room-types', [
            'name' => 'Test Suite',
            'base_price' => 1500,
            'capacity' => 2,
            'flexible_cancellation_days' => 3,
            'non_refundable_discount' => 20,
        ]);

        $response->assertCreated();
        $this->assertEquals(3, $response->json('flexible_cancellation_days'));
        $this->assertEquals(20, $response->json('non_refundable_discount'));
    }

    public function test_admin_room_type_update_accepts_cancellation_fields(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin, ['admin']);
        $rt = $this->roomType();

        $response = $this->putJson("/api/room-types/{$rt->id}", [
            'flexible_cancellation_days' => 7,
            'non_refundable_discount' => 25,
        ]);

        $response->assertOk();
        $this->assertEquals(7, $response->json('flexible_cancellation_days'));
        $this->assertEquals(25, $response->json('non_refundable_discount'));
    }

    public function test_admin_reservation_resource_includes_cancellation_tier(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin, ['admin']);
        $guest = $this->guest();
        $rt = $this->roomType();
        $room = $this->room($rt);
        $r = $this->reservation($guest, $room, 'non_refundable');

        $response = $this->getJson("/api/reservations/{$r->id}");
        $response->assertOk();
        $response->assertJsonFragment(['cancellation_tier' => 'non_refundable']);
    }

    // ─── Review Tests ─────────────────────────────────────────────────

    public function test_guest_can_submit_review_after_checkout(): void
    {
        $guest = $this->guest();
        Sanctum::actingAs($guest, ['guest']);
        $rt = $this->roomType();
        $room = $this->room($rt);
        $r = $this->reservation($guest, $room, 'flexible', 'checked_out');

        $response = $this->postJson('/api/public/reviews', [
            'reservation_id' => $r->id,
            'rating' => 5,
            'title' => 'Great stay',
            'comment' => 'Loved the room!',
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('reviews', [
            'guest_id' => $guest->id,
            'reservation_id' => $r->id,
            'rating' => 5,
            'is_approved' => false,
        ]);
    }

    public function test_guest_cannot_review_twice_same_reservation(): void
    {
        $guest = $this->guest();
        Sanctum::actingAs($guest, ['guest']);
        $rt = $this->roomType();
        $room = $this->room($rt);
        $r = $this->reservation($guest, $room, 'flexible', 'checked_out');

        $this->postJson('/api/public/reviews', [
            'reservation_id' => $r->id,
            'rating' => 5,
        ])->assertCreated();

        $response = $this->postJson('/api/public/reviews', [
            'reservation_id' => $r->id,
            'rating' => 4,
        ]);

        $response->assertStatus(422);
    }

    public function test_guest_cannot_review_non_checked_out_reservation(): void
    {
        $guest = $this->guest();
        Sanctum::actingAs($guest, ['guest']);
        $rt = $this->roomType();
        $room = $this->room($rt);
        $r = $this->reservation($guest, $room, 'flexible', 'confirmed');

        $response = $this->postJson('/api/public/reviews', [
            'reservation_id' => $r->id,
            'rating' => 5,
        ]);

        $response->assertStatus(422);
    }

    public function test_guest_cannot_review_other_guests_reservation(): void
    {
        $guest = $this->guest();
        $otherGuest = $this->guest();
        Sanctum::actingAs($guest, ['guest']);
        $rt = $this->roomType();
        $room = $this->room($rt);
        $r = $this->reservation($otherGuest, $room, 'flexible', 'checked_out');

        $response = $this->postJson('/api/public/reviews', [
            'reservation_id' => $r->id,
            'rating' => 5,
        ]);

        $response->assertStatus(404);
    }

    public function test_admin_can_approve_review(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin, ['admin']);
        $guest = $this->guest();
        $rt = $this->roomType();
        $room = $this->room($rt);
        $r = $this->reservation($guest, $room, 'flexible', 'checked_out');

        $review = Review::create([
            'guest_id' => $guest->id,
            'reservation_id' => $r->id,
            'room_type_id' => $rt->id,
            'rating' => 5,
            'title' => 'Amazing',
            'is_approved' => false,
        ]);

        $response = $this->putJson("/api/reviews/{$review->id}/approve");
        $response->assertOk();

        $review->refresh();
        $this->assertTrue($review->is_approved);

        $rt->refresh();
        $this->assertEquals(5, $rt->avg_rating);
        $this->assertEquals(1, $rt->review_count);
    }

    public function test_admin_can_delete_review(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin, ['admin']);
        $guest = $this->guest();
        $rt = $this->roomType();
        $room = $this->room($rt);
        $r = $this->reservation($guest, $room, 'flexible', 'checked_out');

        $review = Review::create([
            'guest_id' => $guest->id,
            'reservation_id' => $r->id,
            'room_type_id' => $rt->id,
            'rating' => 3,
            'is_approved' => true,
        ]);

        $rt->update(['avg_rating' => 3, 'review_count' => 1]);

        $response = $this->deleteJson("/api/reviews/{$review->id}");
        $response->assertOk();

        $this->assertDatabaseMissing('reviews', ['id' => $review->id]);

        $rt->refresh();
        $this->assertEquals(0, $rt->review_count);
    }

    public function test_admin_can_reply_to_review(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin, ['admin']);
        $guest = $this->guest();
        $rt = $this->roomType();
        $room = $this->room($rt);
        $r = $this->reservation($guest, $room, 'flexible', 'checked_out');

        $review = Review::create([
            'guest_id' => $guest->id,
            'reservation_id' => $r->id,
            'room_type_id' => $rt->id,
            'rating' => 4,
            'is_approved' => true,
        ]);

        $response = $this->postJson("/api/reviews/{$review->id}/reply", [
            'reply' => 'Thank you for your feedback!',
        ]);

        $response->assertOk();
        $review->refresh();
        $this->assertEquals('Thank you for your feedback!', $review->admin_reply);
        $this->assertNotNull($review->admin_replied_at);
    }

    public function test_public_reviews_endpoint_returns_approved_only(): void
    {
        $guest = $this->guest();
        $rt = $this->roomType('Deluxe');
        $room = $this->room($rt);
        $r = $this->reservation($guest, $room, 'flexible', 'checked_out');

        Review::create(['guest_id' => $guest->id, 'reservation_id' => $r->id, 'room_type_id' => $rt->id, 'rating' => 5, 'is_approved' => true]);

        $guest2 = $this->guest();
        $room2 = $this->room($rt, 'R200');
        $r2 = $this->reservation($guest2, $room2, 'flexible', 'checked_out');
        Review::create(['guest_id' => $guest2->id, 'reservation_id' => $r2->id, 'room_type_id' => $rt->id, 'rating' => 3, 'is_approved' => false, 'title' => 'Hidden']);

        $response = $this->getJson("/api/public/rooms/{$rt->slug}/reviews");
        $response->assertOk();

        $reviews = $response->json('reviews');
        $this->assertCount(1, $reviews);
        $this->assertEquals(5, $reviews[0]['rating']);
    }

    public function test_guest_can_list_own_reviews(): void
    {
        $guest = $this->guest();
        Sanctum::actingAs($guest, ['guest']);
        $rt = $this->roomType();
        $room = $this->room($rt);
        $r = $this->reservation($guest, $room, 'flexible', 'checked_out');

        Review::create(['guest_id' => $guest->id, 'reservation_id' => $r->id, 'room_type_id' => $rt->id, 'rating' => 5, 'is_approved' => true]);

        $response = $this->getJson('/api/public/reviews');
        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
    }

    public function test_admin_can_list_all_reviews(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin, ['admin']);
        $guest = $this->guest();
        $rt = $this->roomType();
        $room = $this->room($rt);
        $r = $this->reservation($guest, $room, 'flexible', 'checked_out');

        Review::create(['guest_id' => $guest->id, 'reservation_id' => $r->id, 'room_type_id' => $rt->id, 'rating' => 5, 'is_approved' => true]);

        $response = $this->getJson('/api/reviews');
        $response->assertOk();
        $this->assertArrayHasKey('data', $response->json());
    }

    public function test_non_admin_cannot_approve_review(): void
    {
        $guest = $this->guest();
        Sanctum::actingAs($guest, ['guest']);
        $rt = $this->roomType();
        $room = $this->room($rt);
        $r = $this->reservation($guest, $room, 'flexible', 'checked_out');

        $review = Review::create([
            'guest_id' => $guest->id,
            'reservation_id' => $r->id,
            'room_type_id' => $rt->id,
            'rating' => 5,
            'is_approved' => false,
        ]);

        $response = $this->putJson("/api/reviews/{$review->id}/approve");
        $response->assertStatus(403);
    }

    public function test_review_recuplicates_stats_across_multiple_reviews(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin, ['admin']);
        $rt = $this->roomType();

        $g1 = $this->guest();
        $g2 = $this->guest();
        $room1 = $this->room($rt, 'R100');
        $room2 = $this->room($rt, 'R101');

        $r1 = $this->reservation($g1, $room1, 'flexible', 'checked_out');
        $r2 = $this->reservation($g2, $room2, 'flexible', 'checked_out');

        $rev1 = Review::create(['guest_id' => $g1->id, 'reservation_id' => $r1->id, 'room_type_id' => $rt->id, 'rating' => 4, 'is_approved' => false]);
        $rev2 = Review::create(['guest_id' => $g2->id, 'reservation_id' => $r2->id, 'room_type_id' => $rt->id, 'rating' => 2, 'is_approved' => false]);

        // Approve first — avg=4, count=1
        $this->putJson("/api/reviews/{$rev1->id}/approve")->assertOk();
        $rt->refresh();
        $this->assertEquals(4, $rt->avg_rating);
        $this->assertEquals(1, $rt->review_count);

        // Approve second — avg=3, count=2
        $this->putJson("/api/reviews/{$rev2->id}/approve")->assertOk();
        $rt->refresh();
        $this->assertEqualsWithDelta(3.0, $rt->avg_rating, 0.01);
        $this->assertEquals(2, $rt->review_count);
    }
}
