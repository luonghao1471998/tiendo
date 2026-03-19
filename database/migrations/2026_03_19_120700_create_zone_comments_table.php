<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('zone_comments', function (Blueprint $table) {
            $table->bigIncrements('id');

            $table->foreignId('zone_id')->constrained('zones')->cascadeOnDelete()->notNullable();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete()->notNullable();

            $table->text('content')->notNullable();

            $table->jsonb('images')
                ->notNullable()
                ->default(DB::raw("'[]'::jsonb"));

            $table->timestampsTz();

            $table->index('zone_id', 'idx_zc_zone');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('zone_comments');
    }
};

