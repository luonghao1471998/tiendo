<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class UserManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_list_users(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'is_active' => true,
        ]);
        User::factory()->count(3)->create();

        Sanctum::actingAs($admin);
        $response = $this->getJson('/api/v1/users');

        $response->assertOk()
            ->assertJsonPath('success', true);
        $this->assertGreaterThanOrEqual(4, count($response->json('data')));
    }

    public function test_admin_can_filter_users_by_name_search(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'is_active' => true,
        ]);
        User::factory()->create(['name' => 'Alice Nguyen']);
        User::factory()->create(['name' => 'Bob Tran']);

        Sanctum::actingAs($admin);
        $response = $this->getJson('/api/v1/users?search=Alice&per_page=100');

        $response->assertOk()
            ->assertJsonPath('success', true);
        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertSame('Alice Nguyen', $data[0]['name']);
    }

    public function test_non_admin_cannot_list_users(): void
    {
        $pm = User::factory()->create([
            'role' => 'project_manager',
            'is_active' => true,
        ]);

        Sanctum::actingAs($pm);
        $this->getJson('/api/v1/users')
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN');
    }

    public function test_admin_can_update_user_profile_and_status(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'is_active' => true,
        ]);
        $target = User::factory()->create([
            'name' => 'Old Name',
            'email' => 'old@example.com',
            'is_active' => true,
        ]);

        Sanctum::actingAs($admin);
        $response = $this->putJson('/api/v1/users/'.$target->id, [
            'name' => 'New Name',
            'email' => 'new@example.com',
            'is_active' => false,
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.name', 'New Name')
            ->assertJsonPath('data.email', 'new@example.com')
            ->assertJsonPath('data.is_active', false);

        $this->assertDatabaseHas('users', [
            'id' => $target->id,
            'name' => 'New Name',
            'email' => 'new@example.com',
            'is_active' => false,
        ]);
    }

    public function test_admin_can_create_user(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'is_active' => true,
        ]);

        Sanctum::actingAs($admin);
        $response = $this->postJson('/api/v1/users', [
            'name' => 'New User',
            'email' => 'newuser@example.com',
            'password' => 'secret-pass-1',
            'role' => 'field_team',
            'is_active' => true,
        ]);

        $response->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.email', 'newuser@example.com')
            ->assertJsonPath('data.role', 'field_team');

        $this->assertDatabaseHas('users', [
            'email' => 'newuser@example.com',
            'role' => 'field_team',
            'must_change_password' => true,
        ]);
    }

    public function test_non_admin_cannot_create_user(): void
    {
        $pm = User::factory()->create([
            'role' => 'project_manager',
            'is_active' => true,
        ]);

        Sanctum::actingAs($pm);
        $this->postJson('/api/v1/users', [
            'name' => 'X',
            'email' => 'x@example.com',
            'password' => 'password12',
            'role' => 'viewer',
        ])->assertStatus(403);
    }
}
