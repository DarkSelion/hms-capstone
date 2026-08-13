<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('invoices', 'paid_at')) {
            Schema::table('invoices', function (Blueprint $table) {
                $table->timestamp('paid_at')->nullable()->after('due_date');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('invoices', 'paid_at')) {
            Schema::table('invoices', function (Blueprint $table) {
                $table->dropColumn('paid_at');
            });
        }
    }
};
