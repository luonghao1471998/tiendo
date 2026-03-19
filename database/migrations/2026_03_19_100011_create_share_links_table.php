<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('share_links', function (Blueprint $table) {
            $table->bigIncrements('id');

            $table->foreignId('project_id')->constrained()->cascadeOnDelete()->notNullable();

            $table->string('token', 64)->notNullable()->unique();

            // PATCH-04: viewer-only MVP -> no role column

            $table->foreignId('created_by')->constrained()->cascadeOnDelete()->notNullable();

            $table->timestampTz('expires_at')->notNullable();
            $table->boolean('is_active')->notNullable()->default(true);

            $table->timestampTz('created_at')->notNullable()->useCurrent();

            $table->index(['token'], 'idx_sl_token');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('share_links');
    }
};

