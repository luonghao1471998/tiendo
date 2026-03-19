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
            $table->string('code', 50)->notNullable();
            $table->text('description')->nullable();
            $table->string('address', 500)->nullable();

            $table->foreignId('created_by')->constrained()->cascadeOnDelete()->notNullable();

            $table->timestampsTz();

            $table->unique('code');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('projects');
    }
};

