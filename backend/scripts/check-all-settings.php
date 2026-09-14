<?php

$backend = '/var/www/hotel/backend';
chdir($backend);
require $backend . '/vendor/autoload.php';
$app = require $backend . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

echo 'Searching for any settings related to old GCash/payment features...' . PHP_EOL;
echo str_repeat('-', 60) . PHP_EOL;

$all = DB::table('settings')->select('key', 'group')->orderBy('key')->get();
$keys = $all->pluck('key')->all();

$legacyTerms = ['gcash', 'qr', 'payment_enabled', 'paymongo'];
$matches = [];
foreach ($keys as $key) {
    foreach ($legacyTerms as $term) {
        if (stripos($key, $term) !== false) {
            $matches[] = $key;
            break;
        }
    }
}

if (empty($matches)) {
    echo 'No keys match legacy terms (gcash, qr, payment_enabled, paymongo).' . PHP_EOL;
} else {
    foreach ($matches as $key) {
        $row = $all->firstWhere('key', $key);
        echo "  key={$row->key}, group={$row->group}" . PHP_EOL;
    }
}

echo PHP_EOL . 'All settings keys (' . count($keys) . ' total):' . PHP_EOL;
foreach ($keys as $key) {
    $row = $all->firstWhere('key', $key);
    echo "  [{$row->group}] {$row->key}" . PHP_EOL;
}
