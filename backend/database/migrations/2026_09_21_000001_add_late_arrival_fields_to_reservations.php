<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->dateTime('late_arrival_deadline')->nullable()->after('overdue_at');
            $table->text('late_arrival_notes')->nullable()->after('late_arrival_deadline');
            $table->foreignId('late_arrival_notified_by')->nullable()->constrained('users')->after('late_arrival_notes');
        });
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->dropForeign(['late_arrival_notified_by']);
            $table->dropColumn(['late_arrival_deadline', 'late_arrival_notes', 'late_arrival_notified_by']);
        });
    }
};
