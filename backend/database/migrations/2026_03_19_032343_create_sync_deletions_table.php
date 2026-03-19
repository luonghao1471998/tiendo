<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // PATCH-09: Track deleted zones/marks for polling sync
        Schema::create('sync_deletions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('layer_id')->constrained()->cascadeOnDelete();
            $table->string('entity_type', 20); // 'zone' | 'mark'
            $table->unsignedBigInteger('entity_id');
            $table->timestampTz('deleted_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sync_deletions');
    }
};
