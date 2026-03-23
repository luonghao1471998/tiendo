<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProjectListSearchTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_filter_projects_by_name_search(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'is_active' => true,
        ]);

        Project::query()->create([
            'name' => 'Sun Tower Alpha',
            'code' => 'SUNA',
            'created_by' => $admin->id,
        ]);
        Project::query()->create([
            'name' => 'Moon Villa',
            'code' => 'MOON',
            'created_by' => $admin->id,
        ]);

        Sanctum::actingAs($admin);
        $response = $this->getJson('/api/v1/projects?search=Sun&per_page=100');

        $response->assertOk()
            ->assertJsonPath('success', true);
        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertSame('Sun Tower Alpha', $data[0]['name']);
    }
}
