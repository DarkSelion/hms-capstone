<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SettingsBrandingTest extends TestCase
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
            'is_active' => true,
        ]);
    }

    protected function staff(): User
    {
        $role = Role::create(['name' => 'Receptionist', 'slug' => 'receptionist']);

        return User::create([
            'name' => 'Staff User',
            'email' => 'staff@test.com',
            'password' => Hash::make('password'),
            'role_id' => $role->id,
            'is_active' => true,
        ]);
    }

    // ── Seeded defaults present ─────────────────────────────

    public function test_seeded_branding_settings_are_grouped_correctly(): void
    {
        $this->seed(\Database\Seeders\SettingsSeeder::class);

        $this->assertDatabaseHas('settings', ['key' => 'theme_preset', 'value' => 'gold', 'group' => 'branding']);
        $this->assertDatabaseHas('settings', ['key' => 'hero_title', 'value' => 'Comfortable Stays, Warm Smiles', 'group' => 'branding']);
        $this->assertDatabaseHas('settings', ['key' => 'footer_tagline', 'group' => 'branding']);
        $this->assertDatabaseHas('settings', ['key' => 'gallery_1_image', 'group' => 'branding']);
        $this->assertDatabaseHas('settings', ['key' => 'gallery_12_category', 'group' => 'branding']);
        $this->assertDatabaseHas('settings', ['key' => 'hotel_name', 'group' => 'hotel']);
    }

    // ── Public branding group ───────────────────────────────

    public function test_public_branding_group_returns_decorated_urls(): void
    {
        Setting::create(['key' => 'hero_image_1', 'value' => 'branding/hero1.jpg', 'group' => 'branding']);
        Setting::create(['key' => 'hero_image_2', 'value' => 'https://images.example.com/hero2.jpg', 'group' => 'branding']);
        Setting::create(['key' => 'theme_preset', 'value' => 'navy', 'group' => 'branding']);

        $response = $this->getJson('/api/public/settings/branding')
            ->assertOk()
            ->assertJsonPath('theme_preset', 'navy');

        $json = $response->json();
        $this->assertStringStartsWith('http://localhost/storage/branding/hero1.jpg', $json['hero_image_1']);
        $this->assertSame('https://images.example.com/hero2.jpg', $json['hero_image_2']);
    }

    public function test_public_unknown_group_returns_404(): void
    {
        $this->getJson('/api/public/settings/nope')->assertStatus(404);
    }

    // ── Branding image upload ───────────────────────────────

    public function test_admin_can_upload_branding_image(): void
    {
        Storage::fake('public');

        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $response = $this->post('/api/settings/branding-image', [
            'key' => 'hero_image_1',
            'image' => UploadedFile::fake()->image('hero1.jpg'),
        ])->assertOk()
            ->assertJsonPath('message', 'Image uploaded successfully.')
            ->assertJsonPath('key', 'hero_image_1')
            ->assertJsonStructure(['image_url']);

        $path = str_replace('http://localhost/storage/', '', $response->json('image_url'));
        Storage::disk('public')->assertExists($path);
        $this->assertDatabaseHas('settings', ['key' => 'hero_image_1', 'value' => $path, 'group' => 'branding']);
    }

    public function test_upload_replaces_existing_file(): void
    {
        Storage::fake('public');

        $admin = $this->admin();
        Sanctum::actingAs($admin);

        Setting::create(['key' => 'hero_image_1', 'value' => 'branding/old-hero.jpg', 'group' => 'branding']);
        Storage::disk('public')->put('branding/old-hero.jpg', 'old');

        $response = $this->post('/api/settings/branding-image', [
            'key' => 'hero_image_1',
            'image' => UploadedFile::fake()->image('hero1.jpg'),
        ])->assertOk();

        $path = str_replace('http://localhost/storage/', '', $response->json('image_url'));
        Storage::disk('public')->assertMissing('branding/old-hero.jpg');
        Storage::disk('public')->assertExists($path);
        $this->assertDatabaseHas('settings', ['key' => 'hero_image_1', 'value' => $path]);
    }

    public function test_upload_rejects_unknown_key(): void
    {
        Storage::fake('public');

        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->post('/api/settings/branding-image', [
            'key' => 'not_a_real_key',
            'image' => UploadedFile::fake()->image('x.jpg'),
        ])->assertStatus(422);

        Storage::disk('public')->assertMissing('branding/x.jpg');
    }

    public function test_upload_rejects_invalid_file(): void
    {
        Storage::fake('public');

        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->post('/api/settings/branding-image', [
            'key' => 'hero_image_1',
            'image' => UploadedFile::fake()->create('note.txt', 10),
        ])->assertStatus(422);

        Storage::disk('public')->assertMissing('branding/note.txt');
    }

    public function test_non_admin_cannot_upload_branding_image(): void
    {
        Storage::fake('public');

        $staff = $this->staff();
        Sanctum::actingAs($staff);

        $this->post('/api/settings/branding-image', [
            'key' => 'hero_image_1',
            'image' => UploadedFile::fake()->image('hero1.jpg'),
        ])->assertStatus(403);

        Storage::disk('public')->assertMissing('branding/hero1.jpg');
    }

    // ── Branding image delete ───────────────────────────────

    public function test_admin_can_remove_branding_image(): void
    {
        Storage::fake('public');

        $admin = $this->admin();
        Sanctum::actingAs($admin);

        Setting::create(['key' => 'hero_image_1', 'value' => 'branding/hero1.jpg', 'group' => 'branding']);
        Storage::disk('public')->put('branding/hero1.jpg', 'img');

        $this->delete('/api/settings/branding-image?key=hero_image_1')
            ->assertOk()
            ->assertJsonPath('message', 'Image removed successfully.')
            ->assertJsonPath('image_url', null);

        Storage::disk('public')->assertMissing('branding/hero1.jpg');
        $this->assertDatabaseMissing('settings', ['key' => 'hero_image_1']);
    }

    public function test_non_admin_cannot_remove_branding_image(): void
    {
        Storage::fake('public');

        $staff = $this->staff();
        Sanctum::actingAs($staff);

        Setting::create(['key' => 'hero_image_1', 'value' => 'branding/hero1.jpg', 'group' => 'branding']);
        Storage::disk('public')->put('branding/hero1.jpg', 'img');

        $this->delete('/api/settings/branding-image?key=hero_image_1')->assertStatus(403);

        Storage::disk('public')->assertExists('branding/hero1.jpg');
        $this->assertDatabaseHas('settings', ['key' => 'hero_image_1', 'value' => 'branding/hero1.jpg']);
    }

    // ── Settings update whitelist ───────────────────────────

    public function test_branding_text_can_be_saved_via_settings_update(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->putJson('/api/settings', [
            'settings' => [
                ['key' => 'hero_title', 'value' => 'Our Cozy Haven', 'group' => 'branding'],
                ['key' => 'theme_preset', 'value' => 'emerald', 'group' => 'branding'],
            ],
        ])->assertOk()
            ->assertJsonPath('settings.hero_title', 'Our Cozy Haven')
            ->assertJsonPath('settings.theme_preset', 'emerald');

        $this->assertDatabaseHas('settings', ['key' => 'hero_title', 'value' => 'Our Cozy Haven', 'group' => 'branding']);
        $this->assertDatabaseHas('settings', ['key' => 'theme_preset', 'value' => 'emerald', 'group' => 'branding']);
    }

    public function test_unknown_setting_key_is_rejected(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->putJson('/api/settings', [
            'settings' => [
                ['key' => 'bogus_key', 'value' => 'x', 'group' => 'branding'],
            ],
        ])->assertStatus(422);
    }

    public function test_admin_settings_index_includes_branding_keys(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        Setting::create(['key' => 'hero_title', 'value' => 'Hello', 'group' => 'branding']);
        Setting::create(['key' => 'hotel_favicon', 'value' => 'branding/favicon.png', 'group' => 'branding']);

        $this->getJson('/api/settings')
            ->assertOk()
            ->assertJsonPath('hero_title', 'Hello')
            ->assertJsonPath('hotel_favicon', 'http://localhost/storage/branding/favicon.png');
    }

    // ── Legacy GCash settings removed ──────────────────────

    public function test_legacy_gcash_settings_are_not_allowed_keys(): void
    {
        $allowed = \App\Http\Controllers\Api\SettingController::ALLOWED_KEYS;

        $this->assertNotContains('online_payment_enabled', $allowed, 'Legacy key "online_payment_enabled" must not be re-added to ALLOWED_KEYS.');
        $this->assertNotContains('gcash_account', $allowed, 'Legacy key "gcash_account" must not be re-added to ALLOWED_KEYS.');
        $this->assertNotContains('gcash_qr_image', $allowed, 'Legacy key "gcash_qr_image" must not be re-added to ALLOWED_KEYS.');
    }

    public function test_legacy_gcash_settings_are_not_in_public_redacted_keys(): void
    {
        $redacted = \App\Http\Controllers\Api\SettingController::PUBLIC_REDACTED_KEYS;

        $this->assertNotContains('online_payment_enabled', $redacted, 'Legacy key "online_payment_enabled" should no longer be in PUBLIC_REDACTED_KEYS — it has no code path left.');
        $this->assertNotContains('gcash_account', $redacted, 'Legacy key "gcash_account" should no longer be in PUBLIC_REDACTED_KEYS — it has no code path left.');
        $this->assertNotContains('gcash_qr_image', $redacted, 'Legacy key "gcash_qr_image" should no longer be in PUBLIC_REDACTED_KEYS — it has no code path left.');
    }

    public function test_admin_cannot_set_legacy_gcash_settings(): void
    {
        Sanctum::actingAs($this->admin());

        foreach (['online_payment_enabled', 'gcash_account', 'gcash_qr_image'] as $legacyKey) {
            $response = $this->putJson('/api/settings', [
                'settings' => [['key' => $legacyKey, 'value' => '1']],
            ]);
            $this->assertContains(
                $response->status(),
                [422, 400],
                "Setting legacy key '{$legacyKey}' should be rejected with 4xx, got {$response->status()}"
            );
        }

        foreach (['online_payment_enabled', 'gcash_account', 'gcash_qr_image'] as $legacyKey) {
            $this->assertDatabaseMissing('settings', ['key' => $legacyKey]);
        }
    }
}
