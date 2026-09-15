<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('room_types', function (Blueprint $table) {
            $table->integer('flexible_cancellation_days')->default(1)->after('sort_order');
            $table->decimal('non_refundable_discount', 5, 2)->default(10)->after('flexible_cancellation_days');
        });
    }

    public function down(): void
    {
        Schema::table('room_types', function (Blueprint $table) {
            $table->dropColumn(['flexible_cancellation_days', 'non_refundable_discount']);
        });
    }
};
