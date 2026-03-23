<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('zone_comments')) {
            return;
        }

        Schema::table('zone_comments', function (Blueprint $table) {
            $table->text('content')->nullable()->change();
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('zone_comments')) {
            return;
        }

        Schema::table('zone_comments', function (Blueprint $table) {
            $table->text('content')->nullable(false)->change();
        });
    }
};
