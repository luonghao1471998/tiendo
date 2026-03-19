<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('marks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('zone_id')->constrained()->cascadeOnDelete();
            $table->jsonb('geometry_pct');
            $table->string('status', 50)->default('in_progress');
            $table->text('note')->nullable();
            $table->foreignId('painted_by')->constrained('users');
            $table->timestampsTz();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marks');
    }
};
