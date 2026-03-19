<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('master_layers', function (Blueprint $table) {
            $table->bigIncrements('id');

            $table->foreignId('project_id')->constrained()->cascadeOnDelete()->notNullable();

            $table->string('name', 255)->notNullable();
            $table->string('code', 50)->notNullable();
            $table->integer('sort_order')->notNullable()->default(0);

            $table->timestampsTz();

            $table->unique(['project_id', 'code']);
            $table->index(['project_id'], 'idx_ml_project');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('master_layers');
    }
};

