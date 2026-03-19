<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sync_deletions', function (Blueprint $table) {
            $table->bigIncrements('id');

            $table->foreignId('layer_id')->constrained()->cascadeOnDelete()->notNullable();

            $table->string('entity_type', 20)->notNullable();
            $table->bigInteger('entity_id')->notNullable();

            $table->timestampTz('deleted_at')->notNullable()->useCurrent();

            $table->index(['layer_id', 'deleted_at'], 'idx_sd_layer');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sync_deletions');
    }
};

