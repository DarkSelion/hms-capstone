<?php

$backend = '/var/www/hotel/backend';
chdir($backend);
require $backend . '/vendor/autoload.php';
$app = require $backend . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$legacyKeys = ['online_payment_enabled', 'gcash_account', 'gcash_qr_image'];

echo 'Pre-check: rows matching the 3 legacy keys' . PHP_EOL;
echo str_repeat('-', 60) . PHP_EOL;

$rows = DB::table('settings')->whereIn('key', $legacyKeys)->get();

if ($rows->isEmpty()) {
    echo 'No legacy rows found. Nothing to delete.' . PHP_EOL;
    exit(0);
}

foreach ($rows as $row) {
    $valueLength = strlen($row->value ?? '');
    $preview = $valueLength > 50 ? substr($row->value, 0, 50) . '...' : $row->value;
    echo sprintf(
        "  key=%s, group=%s, value_length=%d, preview=%s, updated_at=%s\n",
        $row->key,
        $row->group,
        $valueLength,
        $preview,
        $row->updated_at
    );
}

echo PHP_EOL . 'Deleting ' . $rows->count() . ' row(s)...' . PHP_EOL;

$deleted = DB::table('settings')->whereIn('key', $legacyKeys)->delete();
echo "Deleted: {$deleted} row(s)" . PHP_EOL;

echo PHP_EOL . 'Post-check:' . PHP_EOL;
$remaining = DB::table('settings')->whereIn('key', $legacyKeys)->count();
echo "Remaining rows: {$remaining}" . PHP_EOL;
echo ($remaining === 0 ? 'OK — all legacy keys removed.' : 'WARNING — some rows still present!') . PHP_EOL;
