<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reviews', function (Blueprint $table) {
            $table->string('status')->default('pending')->after('comment');
            $table->boolean('is_verified_stay')->default(true)->after('status');
            $table->renameColumn('admin_reply', 'admin_response');
        });

        // Convert existing data
        DB::table('reviews')->where('is_approved', true)->update(['status' => 'approved']);
        DB::table('reviews')->where('is_approved', false)->update(['status' => 'pending']);

        Schema::table('reviews', function (Blueprint $table) {
            $table->dropColumn('is_approved');
        });
    }

    public function down(): void
    {
        Schema::table('reviews', function (Blueprint $table) {
            $table->boolean('is_approved')->default(false)->after('comment');
        });

        DB::table('reviews')->where('status', 'approved')->update(['is_approved' => true]);
        DB::table('reviews')->where('status', 'pending')->update(['is_approved' => false]);
        DB::table('reviews')->where('status', 'rejected')->update(['is_approved' => false]);

        Schema::table('reviews', function (Blueprint $table) {
            $table->dropColumn(['status', 'is_verified_stay']);
            $table->renameColumn('admin_response', 'admin_reply');
        });
    }
};
