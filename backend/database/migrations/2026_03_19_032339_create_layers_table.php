<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('layers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('master_layer_id')->constrained()->cascadeOnDelete();
            $table->string('name', 255);
            $table->string('code', 50);
            $table->string('type', 50)->default('architecture');
            $table->string('status', 50)->default('uploading');
            $table->integer('sort_order')->default(0);
            // File info
            $table->string('original_filename', 500);
            $table->string('file_path', 500);
            $table->string('tile_path', 500)->nullable();
            $table->bigInteger('file_size');
            // Dimensions (after processing)
            $table->integer('width_px')->nullable();
            $table->integer('height_px')->nullable();
            // Processing
            $table->integer('retry_count')->default(0);
            $table->text('error_message')->nullable();
            $table->timestampTz('processed_at')->nullable();
            // Race-safe zone sequence (PATCH-15)
            $table->integer('next_zone_seq')->default(0);
            // Audit
            $table->foreignId('uploaded_by')->constrained('users');
            $table->timestampsTz();
            $table->unique(['master_layer_id', 'code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('layers');
    }
};
