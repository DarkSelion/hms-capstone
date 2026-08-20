<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingsSeeder extends Seeder
{
    public function run(): void
    {
        $settings = [
            ['key' => 'hotel_name', 'value' => 'Pampanga Home Suites', 'group' => 'hotel'],
            ['key' => 'hotel_address', 'value' => 'Pampanga, Philippines', 'group' => 'hotel'],
            ['key' => 'hotel_phone', 'value' => '+63 912 345 6789', 'group' => 'hotel'],
            ['key' => 'hotel_email', 'value' => 'info@pampangahomesuites.com', 'group' => 'hotel'],
            ['key' => 'default_currency', 'value' => 'PHP', 'group' => 'hotel'],
            ['key' => 'timezone', 'value' => 'Asia/Manila', 'group' => 'hotel'],
            ['key' => 'tax_name', 'value' => 'VAT', 'group' => 'tax'],
            ['key' => 'tax_rate', 'value' => '10', 'group' => 'tax'],
            ['key' => 'default_discount', 'value' => '0', 'group' => 'booking'],
            ['key' => 'cancellation_policy', 'value' => 'Free cancellation up to 24 hours before check-in', 'group' => 'booking'],
            ['key' => 'max_advance_days', 'value' => '30', 'group' => 'booking'],
            ['key' => 'late_checkout_fee', 'value' => '0', 'group' => 'booking'],
            ['key' => 'check_out_time', 'value' => '11:00', 'group' => 'booking'],
            ['key' => 'contact_heading', 'value' => 'Get in Touch', 'group' => 'contact'],
            ['key' => 'contact_description', 'value' => 'Have a question or special request? We would love to hear from you.', 'group' => 'contact'],
            ['key' => 'contact_reception_hours', 'value' => '24 / 7 — Always Open', 'group' => 'contact'],
            ['key' => 'contact_facebook', 'value' => '#', 'group' => 'contact'],
            ['key' => 'contact_instagram', 'value' => '#', 'group' => 'contact'],
            ['key' => 'contact_tiktok', 'value' => '#', 'group' => 'contact'],
            ['key' => 'contact_map_embed_url', 'value' => 'https://www.google.com/maps?q=Pampanga,+Philippines&output=embed', 'group' => 'contact'],
            ['key' => 'contact_faq', 'value' => json_encode([
                ['q' => 'What time is check-in and check-out?', 'a' => 'Check-in is available 24/7 at our front desk. Check-out time is 11:00 AM. Need more time? Ask our team about late check-out options.'],
                ['q' => 'Do you offer airport transfers?', 'a' => 'Yes, we offer complimentary airport transfers for guests staying 3 nights or more. Contact our concierge to arrange your pickup.'],
                ['q' => 'Is breakfast included in the room rate?', 'a' => 'Breakfast is included with select room types. Please check your booking details or contact us for more information.'],
                ['q' => 'What is your cancellation policy?', 'a' => 'Free cancellation is available up to 24 hours before your scheduled check-in. Cancellations within 24 hours may be subject to a one-night charge.'],
            ]), 'group' => 'contact'],
            ['key' => 'online_gateway_enabled', 'value' => '0', 'group' => 'payment'],
            ['key' => 'online_gateway_base_url', 'value' => 'https://www.hardreset.club', 'group' => 'payment'],
            ['key' => 'online_gateway_api_key', 'value' => '', 'group' => 'payment'],
            ['key' => 'online_gateway_webhook_secret', 'value' => '', 'group' => 'payment'],
            ['key' => 'online_gateway_self_settle', 'value' => '0', 'group' => 'payment'],
            ['key' => 'theme_preset', 'value' => 'gold', 'group' => 'branding'],
            ['key' => 'hero_badge', 'value' => 'Welcome to Pampanga Home Suites', 'group' => 'branding'],
            ['key' => 'hero_title', 'value' => 'Comfortable Stays, Warm Smiles', 'group' => 'branding'],
            ['key' => 'hero_subtitle', 'value' => 'Experience warm Filipino hospitality right here in Pampanga. Every stay feels like coming home.', 'group' => 'branding'],
            ['key' => 'hero_cta_label', 'value' => 'Explore Stays', 'group' => 'branding'],
            ['key' => 'hero_image_1', 'value' => 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1920&h=1080&fit=crop', 'group' => 'branding'],
            ['key' => 'hero_image_2', 'value' => 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1920&h=1080&fit=crop', 'group' => 'branding'],
            ['key' => 'hero_image_3', 'value' => 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1920&h=1080&fit=crop', 'group' => 'branding'],
            ['key' => 'section_discover_title', 'value' => 'Discover Our World', 'group' => 'branding'],
            ['key' => 'section_why_title', 'value' => 'Why Stay With Us', 'group' => 'branding'],
            ['key' => 'section_amenities_title', 'value' => 'Comforts of Home', 'group' => 'branding'],
            ['key' => 'section_gallery_title', 'value' => 'A Glimpse of {hotel_name}', 'group' => 'branding'],
            ['key' => 'footer_tagline', 'value' => 'Cozy stays, warm smiles — right here in Pampanga.', 'group' => 'branding'],
            ['key' => 'hotel_favicon', 'value' => '', 'group' => 'branding'],
            ['key' => 'gallery_1_image', 'value' => 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&q=80', 'group' => 'branding'],
            ['key' => 'gallery_1_title', 'value' => 'Deluxe King Room', 'group' => 'branding'],
            ['key' => 'gallery_1_category', 'value' => 'Rooms & Suites', 'group' => 'branding'],
            ['key' => 'gallery_2_image', 'value' => 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80', 'group' => 'branding'],
            ['key' => 'gallery_2_title', 'value' => 'Ocean View Suite', 'group' => 'branding'],
            ['key' => 'gallery_2_category', 'value' => 'Rooms & Suites', 'group' => 'branding'],
            ['key' => 'gallery_3_image', 'value' => 'https://images.unsplash.com/photo-1591088398332-8a7791972843?w=800&q=80', 'group' => 'branding'],
            ['key' => 'gallery_3_title', 'value' => 'Premier Suite', 'group' => 'branding'],
            ['key' => 'gallery_3_category', 'value' => 'Rooms & Suites', 'group' => 'branding'],
            ['key' => 'gallery_4_image', 'value' => 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80', 'group' => 'branding'],
            ['key' => 'gallery_4_title', 'value' => 'Premium Twin Room', 'group' => 'branding'],
            ['key' => 'gallery_4_category', 'value' => 'Rooms & Suites', 'group' => 'branding'],
            ['key' => 'gallery_5_image', 'value' => 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800&q=80', 'group' => 'branding'],
            ['key' => 'gallery_5_title', 'value' => 'Garden Suite', 'group' => 'branding'],
            ['key' => 'gallery_5_category', 'value' => 'Rooms & Suites', 'group' => 'branding'],
            ['key' => 'gallery_6_image', 'value' => 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80', 'group' => 'branding'],
            ['key' => 'gallery_6_title', 'value' => 'Family Room', 'group' => 'branding'],
            ['key' => 'gallery_6_category', 'value' => 'Rooms & Suites', 'group' => 'branding'],
            ['key' => 'gallery_7_image', 'value' => 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&q=80', 'group' => 'branding'],
            ['key' => 'gallery_7_title', 'value' => 'Infinity Pool', 'group' => 'branding'],
            ['key' => 'gallery_7_category', 'value' => 'Amenities', 'group' => 'branding'],
            ['key' => 'gallery_8_image', 'value' => 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&q=80', 'group' => 'branding'],
            ['key' => 'gallery_8_title', 'value' => 'Poolside Lounge', 'group' => 'branding'],
            ['key' => 'gallery_8_category', 'value' => 'Amenities', 'group' => 'branding'],
            ['key' => 'gallery_9_image', 'value' => 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80', 'group' => 'branding'],
            ['key' => 'gallery_9_title', 'value' => 'Swimming Pool', 'group' => 'branding'],
            ['key' => 'gallery_9_category', 'value' => 'Amenities', 'group' => 'branding'],
            ['key' => 'gallery_10_image', 'value' => 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&q=80', 'group' => 'branding'],
            ['key' => 'gallery_10_title', 'value' => 'Hotel Lobby', 'group' => 'branding'],
            ['key' => 'gallery_10_category', 'value' => 'Amenities', 'group' => 'branding'],
            ['key' => 'gallery_11_image', 'value' => 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80', 'group' => 'branding'],
            ['key' => 'gallery_11_title', 'value' => 'Resort View', 'group' => 'branding'],
            ['key' => 'gallery_11_category', 'value' => 'Amenities', 'group' => 'branding'],
            ['key' => 'gallery_12_image', 'value' => '', 'group' => 'branding'],
            ['key' => 'gallery_12_title', 'value' => 'Cozy Lounge', 'group' => 'branding'],
            ['key' => 'gallery_12_category', 'value' => 'Amenities', 'group' => 'branding'],
        ];

        foreach ($settings as $setting) {
            Setting::updateOrCreate(
                ['key' => $setting['key']],
                ['value' => $setting['value'], 'group' => $setting['group']]
            );
        }
    }
}
