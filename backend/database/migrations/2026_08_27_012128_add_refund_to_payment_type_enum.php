<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // The payment_type column is a string. The 'refund' value is now valid
        // and validated at the application level (PaymentController, PaymentModal).
        // No schema change needed for string column, but migration documents the change.
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No schema change to revert
    }
};
