<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('rooms', 'bed_type')) {
            Schema::table('rooms', function (Blueprint $table) {
                $table->string('bed_type', 50)->nullable()->after('floor');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('rooms', 'bed_type')) {
            Schema::table('rooms', function (Blueprint $table) {
                $table->dropColumn('bed_type');
            });
        }
    }
};