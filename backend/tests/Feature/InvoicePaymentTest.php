<?php

namespace Tests\Feature;

use App\Models\Guest;
use App\Models\Reservation;
use App\Models\Role;
use App\Models\Room;
use App\Models\RoomType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class InvoicePaymentTest extends TestCase
{
    use RefreshDatabase;

    protected function admin(): User
    {
        $role = Role::create(['name' => 'Administrator', 'slug' => 'admin']);

        return User::create([
            'name' => 'Admin User',
            'email' => 'admin@test.com',
            'password' => Hash::make('password'),
            'role_id' => $role->id,
        ]);
    }

    protected function makeReservation(int $total = 5000): Reservation
    {
        $guest = Guest::create([
            'first_name' => 'Jane',
            'last_name' => 'Doe',
            'email' => 'jane@example.com',
            'phone' => '09171234567',
            'password' => Hash::make('password'),
        ]);
        $type = RoomType::create([
            'name' => 'Deluxe',
            'slug' => 'deluxe',
            'base_price' => 1000,
        ]);
        $room = Room::create([
            'room_number' => '101',
            'room_type_id' => $type->id,
            'floor' => 1,
            'status' => 'available',
            'capacity' => 2,
        ]);

        return Reservation::create([
            'reservation_number' => 'BK-TEST-'.random_int(1000, 9999),
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'status' => 'confirmed',
            'check_in' => '2026-09-10',
            'check_out' => '2026-09-12',
            'adults' => 2,
            'price_per_night' => $total / 2,
            'total_nights' => 2,
            'subtotal' => $total,
            'total_amount' => $total,
            'due_amount' => $total,
        ]);
    }

    public function test_marking_invoice_paid_updates_reservation_correctly(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);
        $reservation = $this->makeReservation(5000);

        $create = $this->postJson('/api/invoices', [
            'reservation_id' => $reservation->id,
            'guest_first_name' => 'Jane',
            'guest_last_name' => 'Doe',
            'guest_email' => 'jane@example.com',
            'guest_phone' => '0917',
            'subtotal' => 5000,
            'tax_percent' => 0,
            'tax_amount' => 0,
            'discount_amount' => 0,
            'items' => [
                ['description' => 'Room charge', 'quantity' => 1, 'unit_price' => 5000],
            ],
        ]);
        $create->assertStatus(201);
        $invoiceId = $create->json('id');

        $this->putJson("/api/invoices/{$invoiceId}", [
            'status' => 'paid',
        ])->assertStatus(200);

        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'paid_amount' => 5000,
            'payment_status' => 'paid',
            'due_amount' => 0,
        ]);
    }

    public function test_invoice_pdf_export_returns_pdf(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);
        $reservation = $this->makeReservation(5000);

        $create = $this->postJson('/api/invoices', [
            'reservation_id' => $reservation->id,
            'guest_first_name' => 'Jane',
            'guest_last_name' => 'Doe',
            'guest_email' => 'jane@example.com',
            'guest_phone' => '0917',
            'subtotal' => 5000,
            'tax_percent' => 0,
            'tax_amount' => 0,
            'discount_amount' => 0,
            'items' => [
                ['description' => 'Room charge', 'quantity' => 1, 'unit_price' => 5000],
            ],
        ]);
        $create->assertStatus(201);
        $invoiceId = $create->json('id');

        $response = $this->get("/api/invoices/{$invoiceId}/pdf");
        $response->assertOk();
        $response->assertHeader('Content-Type', 'application/pdf');

        $this->assertStringStartsWith('%PDF', $response->getContent());
    }

    public function test_unmarking_paid_invoice_reverts_reservation_paid_amount(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);
        $reservation = $this->makeReservation(5000);

        $create = $this->postJson('/api/invoices', [
            'reservation_id' => $reservation->id,
            'guest_first_name' => 'Jane',
            'guest_last_name' => 'Doe',
            'guest_email' => 'jane@example.com',
            'guest_phone' => '0917',
            'subtotal' => 5000,
            'tax_percent' => 0,
            'tax_amount' => 0,
            'discount_amount' => 0,
            'items' => [
                ['description' => 'Room charge', 'quantity' => 1, 'unit_price' => 5000],
            ],
        ]);
        $invoiceId = $create->json('id');

        $this->putJson("/api/invoices/{$invoiceId}", ['status' => 'paid'])->assertStatus(200);

        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'paid_amount' => 5000,
            'payment_status' => 'paid',
        ]);

        $this->putJson("/api/invoices/{$invoiceId}", ['status' => 'draft'])->assertStatus(200);

        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'paid_amount' => 0,
            'payment_status' => 'unpaid',
            'due_amount' => 5000,
        ]);
    }

    public function test_guest_cannot_pay_cancelled_reservation(): void
    {
        $reservation = $this->makeReservation(2000);
        $reservation->update(['status' => 'cancelled']);
        $guest = $reservation->guest;
        Sanctum::actingAs($guest);

        $this->postJson('/api/public/payments', [
            'reservation_id' => $reservation->id,
            'amount' => 2000,
            'payment_method' => 'gcash',
            'payment_type' => 'full',
        ])->assertStatus(422);
    }

    public function test_guest_cannot_submit_refund_type(): void
    {
        $reservation = $this->makeReservation(2000);
        $guest = $reservation->guest;
        Sanctum::actingAs($guest);

        $this->postJson('/api/public/payments', [
            'reservation_id' => $reservation->id,
            'amount' => 2000,
            'payment_method' => 'gcash',
            'payment_type' => 'refund',
        ])->assertStatus(422);
    }
}
