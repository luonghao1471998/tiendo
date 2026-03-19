<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('master_layers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('name', 255);
            $table->string('code', 50);
            $table->integer('sort_order')->default(0);
            $table->timestampsTz();
            $table->unique(['project_id', 'code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('master_layers');
    }
};
