<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('projects', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('name', 255)->notNullable();
            $table->string('code', 50)->notNullable()->unique();
            $table->text('description')->nullable();
            $table->string('address', 500)->nullable();

            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete()->notNullable();

            $table->timestampsTz();

            $table->index('created_by');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('projects');
    }
};

