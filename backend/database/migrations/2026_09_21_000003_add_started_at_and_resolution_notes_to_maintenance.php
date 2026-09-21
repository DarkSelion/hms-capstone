<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('maintenance_requests', function (Blueprint $table) {
            if (!Schema::hasColumn('maintenance_requests', 'started_at')) {
                $table->timestamp('started_at')->nullable()->after('actual_cost');
            }
            if (!Schema::hasColumn('maintenance_requests', 'resolution_notes')) {
                $table->text('resolution_notes')->nullable()->after('started_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('maintenance_requests', function (Blueprint $table) {
            $table->dropColumn(['started_at', 'resolution_notes']);
        });
    }
};
