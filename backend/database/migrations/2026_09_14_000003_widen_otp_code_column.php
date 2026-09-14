<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (config('database.default') === 'mysql') {
            Schema::table('otp_codes', function (Blueprint $table) {
                $table->string('code', 64)->change();
            });
        }
    }

    public function down(): void
    {
        if (config('database.default') === 'mysql') {
            Schema::table('otp_codes', function (Blueprint $table) {
                $table->string('code', 6)->change();
            });
        }
    }
};
