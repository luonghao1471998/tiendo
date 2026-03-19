<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $password = env('ADMIN_PASSWORD');

        if (!is_string($password) || $password === '') {
            $password = 'admin';
        }

        User::updateOrCreate(
            ['email' => 'admin@tiendo.vn'],
            [
                'name' => 'Admin',
                'password' => Hash::make($password),
                'role' => 'admin',
                'is_active' => true,
            ],
        );
    }
}

