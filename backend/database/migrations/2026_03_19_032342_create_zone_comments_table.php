<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('zone_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('zone_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users');
            $table->text('content')->nullable();
            $table->jsonb('images')->default('[]'); // ["comments/1/img1.jpg", ...]
            $table->timestampsTz();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('zone_comments');
    }
};
