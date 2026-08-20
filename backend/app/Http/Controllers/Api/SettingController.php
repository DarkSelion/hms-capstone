<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class SettingController extends Controller
{
    public const ALLOWED_KEYS = [
        'hotel_name',
        'hotel_address',
        'hotel_phone',
        'hotel_email',
        'hotel_logo',
        'default_currency',
        'timezone',
        'tax_name',
        'tax_rate',
        'default_discount',
        'cancellation_policy',
        'max_advance_days',
        'early_checkin_fee',
        'late_checkout_fee',
        'check_out_time',
        'contact_heading',
        'contact_description',
        'contact_reception_hours',
        'contact_facebook',
        'contact_instagram',
        'contact_tiktok',
        'contact_map_embed_url',
        'contact_faq',
        'online_gateway_enabled',
        'online_gateway_base_url',
        'online_gateway_api_key',
        'online_gateway_webhook_secret',
        'online_gateway_self_settle',
        'password_min_length',
        'session_timeout',
        'max_login_attempts',
        'two_factor_auth',
        'theme_preset',
        'hero_badge',
        'hero_title',
        'hero_subtitle',
        'hero_cta_label',
        'hero_image_1',
        'hero_image_2',
        'hero_image_3',
        'section_discover_title',
        'section_why_title',
        'section_amenities_title',
        'section_gallery_title',
        'footer_tagline',
        'hotel_favicon',
        'gallery_1_image',
        'gallery_1_title',
        'gallery_1_category',
        'gallery_2_image',
        'gallery_2_title',
        'gallery_2_category',
        'gallery_3_image',
        'gallery_3_title',
        'gallery_3_category',
        'gallery_4_image',
        'gallery_4_title',
        'gallery_4_category',
        'gallery_5_image',
        'gallery_5_title',
        'gallery_5_category',
        'gallery_6_image',
        'gallery_6_title',
        'gallery_6_category',
        'gallery_7_image',
        'gallery_7_title',
        'gallery_7_category',
        'gallery_8_image',
        'gallery_8_title',
        'gallery_8_category',
        'gallery_9_image',
        'gallery_9_title',
        'gallery_9_category',
        'gallery_10_image',
        'gallery_10_title',
        'gallery_10_category',
        'gallery_11_image',
        'gallery_11_title',
        'gallery_11_category',
        'gallery_12_image',
        'gallery_12_title',
        'gallery_12_category',
    ];

    public const BRANDING_IMAGE_KEYS = [
        'hero_image_1',
        'hero_image_2',
        'hero_image_3',
        'hotel_favicon',
        'gallery_1_image',
        'gallery_2_image',
        'gallery_3_image',
        'gallery_4_image',
        'gallery_5_image',
        'gallery_6_image',
        'gallery_7_image',
        'gallery_8_image',
        'gallery_9_image',
        'gallery_10_image',
        'gallery_11_image',
        'gallery_12_image',
    ];

    public const PUBLIC_GROUPS = ['hotel', 'contact', 'tax', 'booking', 'payment', 'branding'];

    /** Keys that are server-only and must never be exposed on public endpoints. */
    public const PUBLIC_REDACTED_KEYS = [
        'online_gateway_api_key',
        'online_gateway_webhook_secret',
        // Legacy GCash keys (removed from code) — stale rows may still exist in
        // the DB and must not leak to the portal.
        'online_payment_enabled',
        'gcash_account',
        'gcash_qr_image',
    ];

    public function index()
    {
        $settings = Setting::all()->pluck('value', 'key');

        return response()->json(self::decorate($settings));
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'settings' => 'required|array',
            'settings.*.key' => ['required', 'string', 'max:100', Rule::in(self::ALLOWED_KEYS)],
            'settings.*.value' => 'nullable|string',
        ]);

        foreach ($data['settings'] as $setting) {
            Setting::updateOrCreate(
                ['key' => $setting['key']],
                ['value' => $setting['value'] ?? '', 'group' => self::groupForKey($setting['key'])]
            );
        }

        $settings = Setting::all()->pluck('value', 'key');

        return response()->json([
            'message' => 'Settings updated successfully.',
            'settings' => $settings,
        ]);
    }

    public static function groupForKey(string $key): string
    {
        if (str_starts_with($key, 'hotel_') || in_array($key, ['default_currency', 'timezone'])) {
            return 'hotel';
        }
        if (str_starts_with($key, 'contact_')) {
            return 'contact';
        }
        if (in_array($key, ['tax_name', 'tax_rate'])) {
            return 'tax';
        }
        if (in_array($key, ['password_min_length', 'session_timeout', 'max_login_attempts', 'two_factor_auth'])) {
            return 'security';
        }
        if (in_array($key, ['default_discount', 'cancellation_policy', 'max_advance_days', 'early_checkin_fee', 'late_checkout_fee', 'check_out_time'])) {
            return 'booking';
        }
        if (str_starts_with($key, 'online_')) {
            return 'payment';
        }
        if (in_array($key, ['theme_preset', 'hotel_favicon']) ||
            str_starts_with($key, 'hero_') ||
            str_starts_with($key, 'about_') ||
            str_starts_with($key, 'stat_') ||
            str_starts_with($key, 'section_') ||
            str_starts_with($key, 'gallery_') ||
            str_starts_with($key, 'footer_')) {
            return 'branding';
        }

        return 'general';
    }

    public function byGroup(string $group)
    {
        $settings = Setting::where('group', $group)->get()->pluck('value', 'key');

        return response()->json(self::decorate($settings));
    }

    public function publicByGroup(string $group)
    {
        if (! in_array($group, self::PUBLIC_GROUPS, true)) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        $settings = Setting::where('group', $group)->get()->pluck('value', 'key');

        $settings->forget(self::PUBLIC_REDACTED_KEYS);

        return response()->json(self::decorate($settings));
    }

    public function uploadLogo(Request $request)
    {
        $request->validate([
            'logo' => 'required|image|mimes:jpeg,png,webp|max:2048',
        ]);

        $current = Setting::where('key', 'hotel_logo')->first();
        if ($current && $current->value) {
            Storage::disk('public')->delete($current->value);
        }

        $path = $request->file('logo')->store('branding', 'public');

        Setting::updateOrCreate(
            ['key' => 'hotel_logo'],
            ['value' => $path, 'group' => 'hotel']
        );

        return response()->json([
            'message' => 'Logo uploaded successfully.',
            'logo_url' => url('storage/' . ltrim($path, '/')),
        ]);
    }

    public function deleteLogo()
    {
        $current = Setting::where('key', 'hotel_logo')->first();
        if ($current && $current->value) {
            Storage::disk('public')->delete($current->value);
        }

        Setting::where('key', 'hotel_logo')->delete();

        return response()->json(['message' => 'Logo removed successfully.']);
    }

    public function uploadBrandingImage(Request $request)
    {
        $data = $request->validate([
            'key' => ['required', 'string', Rule::in(self::BRANDING_IMAGE_KEYS)],
            'image' => 'required|image|mimes:jpeg,png,webp|max:2048',
        ]);

        $key = $data['key'];

        $current = Setting::where('key', $key)->first();
        if ($current && $current->value) {
            Storage::disk('public')->delete($current->value);
        }

        $path = $request->file('image')->store('branding', 'public');

        Setting::updateOrCreate(
            ['key' => $key],
            ['value' => $path, 'group' => 'branding']
        );

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'updated',
            'module' => 'settings',
            'model_type' => 'Setting',
            'model_id' => $key,
            'description' => "Updated branding image: {$key}",
        ]);

        return response()->json([
            'message' => 'Image uploaded successfully.',
            'key' => $key,
            'image_url' => url('storage/' . ltrim($path, '/')),
        ]);
    }

    public function deleteBrandingImage(Request $request)
    {
        $request->validate([
            'key' => ['required', 'string', Rule::in(self::BRANDING_IMAGE_KEYS)],
        ]);

        $key = $request->query('key');

        $current = Setting::where('key', $key)->first();
        if ($current && $current->value) {
            Storage::disk('public')->delete($current->value);
        }

        Setting::where('key', $key)->delete();

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'deleted',
            'module' => 'settings',
            'model_type' => 'Setting',
            'model_id' => $key,
            'description' => "Removed branding image: {$key}",
        ]);

        return response()->json([
            'message' => 'Image removed successfully.',
            'key' => $key,
            'image_url' => null,
        ]);
    }

    protected static function decorate($settings)
    {
        if (!empty($settings['hotel_logo'])) {
            $settings['hotel_logo'] = self::toStorageUrl($settings['hotel_logo']);
        }

        foreach (self::BRANDING_IMAGE_KEYS as $key) {
            if (!empty($settings[$key])) {
                $settings[$key] = self::toStorageUrl($settings[$key]);
            }
        }

        return $settings;
    }

    protected static function toStorageUrl(string $value): string
    {
        if (str_starts_with($value, 'http://') || str_starts_with($value, 'https://')) {
            return $value;
        }

        return url('storage/' . ltrim($value, '/'));
    }
}
