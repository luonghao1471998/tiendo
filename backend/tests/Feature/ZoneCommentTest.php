<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Layer;
use App\Models\MasterLayer;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use App\Models\Zone;
use App\Models\ZoneComment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ZoneCommentTest extends TestCase
{
    use RefreshDatabase;

    public function test_member_can_create_comment_with_images_and_activity_log(): void
    {
        Storage::fake('local');
        [$pm, $field, $zone] = $this->createContext();
        Sanctum::actingAs($field);

        $response = $this->postJson('/api/v1/zones/'.$zone->id.'/comments', [
            'content' => 'Cap nhat tien do',
            'images' => [
                UploadedFile::fake()->image('a.jpg', 100, 100),
                UploadedFile::fake()->image('b.png', 100, 100),
            ],
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.content', 'Cap nhat tien do');

        $commentId = (int) $response->json('data.id');
        $images = $response->json('data.images');
        $this->assertCount(2, $images);

        foreach ($images as $path) {
            Storage::disk('local')->assertExists((string) $path);
        }

        $this->assertDatabaseHas('activity_logs', [
            'target_type' => 'comment',
            'target_id' => $commentId,
            'action' => 'created',
            'user_id' => $field->id,
        ]);

        Sanctum::actingAs($pm);
        $this->getJson('/api/v1/zones/'.$zone->id.'/comments')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.0.id', $commentId);
    }

    public function test_create_comment_rejects_too_many_images(): void
    {
        Storage::fake('local');
        [, $field, $zone] = $this->createContext();
        Sanctum::actingAs($field);

        $this->postJson('/api/v1/zones/'.$zone->id.'/comments', [
            'content' => 'Too many',
            'images' => [
                UploadedFile::fake()->image('1.jpg'),
                UploadedFile::fake()->image('2.jpg'),
                UploadedFile::fake()->image('3.jpg'),
                UploadedFile::fake()->image('4.jpg'),
                UploadedFile::fake()->image('5.jpg'),
                UploadedFile::fake()->image('6.jpg'),
            ],
        ])->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    public function test_create_comment_rejects_oversized_image(): void
    {
        Storage::fake('local');
        [, $field, $zone] = $this->createContext();
        Sanctum::actingAs($field);

        $largeImage = UploadedFile::fake()->image('large.jpg')->size(11000);

        $this->postJson('/api/v1/zones/'.$zone->id.'/comments', [
            'content' => 'Image too big',
            'images' => [$largeImage],
        ])->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    public function test_comment_image_endpoint_and_delete_policy(): void
    {
        Storage::fake('local');
        [$pm, $field, $zone] = $this->createContext();
        $viewer = User::factory()->create([
            'role' => 'viewer',
            'is_active' => true,
        ]);

        ProjectMember::query()->create([
            'project_id' => $zone->layer->masterLayer->project_id,
            'user_id' => $viewer->id,
            'role' => 'viewer',
            'created_at' => now(),
        ]);

        Sanctum::actingAs($field);
        $create = $this->postJson('/api/v1/zones/'.$zone->id.'/comments', [
            'content' => 'Anh hien truong',
            'images' => [UploadedFile::fake()->image('proof.jpg')],
        ])->assertStatus(201);

        $commentId = (int) $create->json('data.id');
        $imagePath = (string) $create->json('data.images.0');
        $filename = basename($imagePath);

        Sanctum::actingAs($viewer);
        $this->get('/api/v1/comments/'.$commentId.'/images/'.$filename)
            ->assertOk();

        $outsider = User::factory()->create([
            'role' => 'field_team',
            'is_active' => true,
        ]);
        Sanctum::actingAs($outsider);
        $this->deleteJson('/api/v1/comments/'.$commentId)
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN');

        Sanctum::actingAs($pm);
        $this->deleteJson('/api/v1/comments/'.$commentId)
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseMissing('zone_comments', [
            'id' => $commentId,
        ]);
        Storage::disk('local')->assertMissing($imagePath);

        $deletedLog = DB::table('activity_logs')
            ->where('target_type', 'comment')
            ->where('target_id', $commentId)
            ->where('action', 'deleted')
            ->exists();
        $this->assertTrue($deletedLog);
    }

    /**
     * @return array{0: User, 1: User, 2: Zone}
     */
    private function createContext(): array
    {
        $pm = User::factory()->create([
            'role' => 'project_manager',
            'is_active' => true,
        ]);
        $field = User::factory()->create([
            'role' => 'field_team',
            'is_active' => true,
        ]);

        $project = Project::query()->create([
            'name' => 'P',
            'code' => 'PRJ',
            'created_by' => $pm->id,
        ]);

        ProjectMember::query()->create([
            'project_id' => $project->id,
            'user_id' => $pm->id,
            'role' => 'project_manager',
            'created_at' => now(),
        ]);
        ProjectMember::query()->create([
            'project_id' => $project->id,
            'user_id' => $field->id,
            'role' => 'field_team',
            'created_at' => now(),
        ]);

        $masterLayer = MasterLayer::query()->create([
            'project_id' => $project->id,
            'name' => 'ML',
            'code' => 'T1',
            'sort_order' => 0,
        ]);
        $layer = Layer::query()->create([
            'master_layer_id' => $masterLayer->id,
            'name' => 'L',
            'code' => 'KT',
            'type' => 'architecture',
            'status' => 'ready',
            'sort_order' => 0,
            'original_filename' => 'a.pdf',
            'file_path' => 'layers/1/original.pdf',
            'tile_path' => 'layers/1/tiles',
            'file_size' => 1,
            'width_px' => 1000,
            'height_px' => 1000,
            'retry_count' => 0,
            'next_zone_seq' => 1,
            'uploaded_by' => $pm->id,
        ]);

        $zone = Zone::query()->create([
            'layer_id' => $layer->id,
            'zone_code' => 'PRJ_T1_KT_001',
            'name' => 'Z1',
            'geometry_pct' => [
                'type' => 'polygon',
                'points' => [
                    ['x' => 0.1, 'y' => 0.1],
                    ['x' => 0.6, 'y' => 0.1],
                    ['x' => 0.6, 'y' => 0.6],
                ],
            ],
            'status' => 'in_progress',
            'completion_pct' => 30,
            'assigned_user_id' => $field->id,
            'created_by' => $pm->id,
        ]);

        return [$pm, $field, $zone];
    }
}
