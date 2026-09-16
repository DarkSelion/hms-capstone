<?php

namespace App\Helpers;

class DataMasker
{
    /**
     * Mask an email address: "j***@gmail.com"
     */
    public static function maskEmail(?string $email): string
    {
        if (empty($email)) {
            return '—';
        }

        $parts = explode('@', $email);
        if (count($parts) !== 2) {
            return '—';
        }

        $name = $parts[0];
        $domain = $parts[1];

        if (strlen($name) <= 1) {
            return '*' . '@' . $domain;
        }

        return $name[0] . str_repeat('*', min(3, strlen($name) - 1)) . '@' . $domain;
    }

    /**
     * Mask a phone number: "+639****7890"
     */
    public static function maskPhone(?string $phone): string
    {
        if (empty($phone)) {
            return '—';
        }

        $digits = preg_replace('/[^0-9]/', '', $phone);

        if (strlen($digits) <= 4) {
            return str_repeat('*', strlen($digits));
        }

        $visibleStart = substr($digits, 0, 2);
        $visibleEnd = substr($digits, -4);
        $masked = str_repeat('*', strlen($digits) - 6);

        // Re-add the + prefix if present
        $prefix = str_starts_with($phone, '+') ? '+' : '';

        return $prefix . $visibleStart . $masked . $visibleEnd;
    }

    /**
     * Mask a name: "J*** C***"
     */
    public static function maskName(?string $name): string
    {
        if (empty($name)) {
            return '—';
        }

        $parts = explode(' ', $name);
        $masked = array_map(function ($part) {
            if (strlen($part) <= 1) {
                return '*';
            }
            return $part[0] . str_repeat('*', min(3, strlen($part) - 1));
        }, $parts);

        return implode(' ', $masked);
    }

    /**
     * Mask a credit card number: "**** **** **** 1234"
     */
    public static function maskCard(?string $card): string
    {
        if (empty($card)) {
            return '—';
        }

        $digits = preg_replace('/[^0-9]/', '', $card);

        if (strlen($digits) <= 4) {
            return str_repeat('*', strlen($digits));
        }

        return '**** **** **** ' . substr($digits, -4);
    }

    /**
     * Recursively mask sensitive fields in an array.
     * Looks for keys: email, phone, guest_email, guest_phone, customer_email, etc.
     */
    public static function maskArray(array $data): array
    {
        $emailKeys = ['email', 'guest_email', 'customer_email', 'user_email'];
        $phoneKeys = ['phone', 'guest_phone', 'customer_phone', 'user_phone', 'phone_number'];
        $nameKeys = ['name', 'guest_name', 'customer_name', 'first_name', 'last_name'];

        $masked = [];
        foreach ($data as $key => $value) {
            if (is_array($value)) {
                $masked[$key] = self::maskArray($value);
            } elseif (in_array(strtolower($key), $emailKeys) && is_string($value)) {
                $masked[$key] = self::maskEmail($value);
            } elseif (in_array(strtolower($key), $phoneKeys) && is_string($value)) {
                $masked[$key] = self::maskPhone($value);
            } elseif (in_array(strtolower($key), $nameKeys) && is_string($value) && $key !== 'name') {
                // Don't mask the 'name' key in activity logs (it's the actor name, not PII)
                $masked[$key] = self::maskName($value);
            } else {
                $masked[$key] = $value;
            }
        }

        return $masked;
    }
}
