<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Layer;
use App\Models\MasterLayer;
use App\Models\Notification;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use App\Models\Zone;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CheckDeadlinesCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_command_creates_notifications_for_pm_and_assignee_only(): void
    {
        [$project, $pm1, $pm2, $assignedField, $viewer] = $this->createProjectContext();
        $layer = $this->createLayer($project, $pm1);

        $zoneEligible = Zone::query()->create([
            'layer_id' => $layer->id,
            'zone_code' => 'PRJ_T1_KT_001',
            'name' => 'Z1',
            'geometry_pct' => $this->geometry(),
            'status' => 'in_progress',
            'completion_pct' => 30,
            'assigned_user_id' => $assignedField->id,
            'deadline' => now()->addDays(2)->toDateString(),
            'created_by' => $pm1->id,
        ]);

        Zone::query()->create([
            'layer_id' => $layer->id,
            'zone_code' => 'PRJ_T1_KT_002',
            'name' => 'Completed',
            'geometry_pct' => $this->geometry(),
            'status' => 'completed',
            'completion_pct' => 100,
            'assigned_user_id' => $assignedField->id,
            'deadline' => now()->addDays(2)->toDateString(),
            'created_by' => $pm1->id,
        ]);

        Zone::query()->create([
            'layer_id' => $layer->id,
            'zone_code' => 'PRJ_T1_KT_003',
            'name' => 'OutsideWindow',
            'geometry_pct' => $this->geometry(),
            'status' => 'in_progress',
            'completion_pct' => 50,
            'assigned_user_id' => $assignedField->id,
            'deadline' => now()->addDays(10)->toDateString(),
            'created_by' => $pm1->id,
        ]);

        $this->artisan('tiendo:check-deadlines')
            ->expectsOutputToContain('Processed zones')
            ->assertExitCode(0);

        $this->assertDatabaseHas('notifications', [
            'user_id' => $pm1->id,
            'type' => 'deadline_approaching',
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $pm2->id,
            'type' => 'deadline_approaching',
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $assignedField->id,
            'type' => 'deadline_approaching',
        ]);
        $this->assertDatabaseMissing('notifications', [
            'user_id' => $viewer->id,
            'type' => 'deadline_approaching',
        ]);

        $count = Notification::query()
            ->where('type', 'deadline_approaching')
            ->where('data->zone_id', (int) $zoneEligible->id)
            ->count();
        $this->assertSame(3, $count);
    }

    public function test_command_dedupes_unread_notifications_per_user_zone_type(): void
    {
        [$project, $pm1, $pm2, $assignedField] = $this->createProjectContextWithoutViewer();
        $layer = $this->createLayer($project, $pm1);

        $zone = Zone::query()->create([
            'layer_id' => $layer->id,
            'zone_code' => 'PRJ_T1_KT_001',
            'name' => 'Z1',
            'geometry_pct' => $this->geometry(),
            'status' => 'in_progress',
            'completion_pct' => 30,
            'assigned_user_id' => $assignedField->id,
            'deadline' => now()->addDay()->toDateString(),
            'created_by' => $pm1->id,
        ]);

        $this->artisan('tiendo:check-deadlines')->assertExitCode(0);
        $this->artisan('tiendo:check-deadlines')->assertExitCode(0);

        $count = Notification::query()
            ->where('type', 'deadline_approaching')
            ->where('data->zone_id', (int) $zone->id)
            ->count();
        $this->assertSame(3, $count);
    }

    public function test_command_creates_new_notification_after_previous_marked_read(): void
    {
        [$project, $pm1, $pm2, $assignedField] = $this->createProjectContextWithoutViewer();
        $layer = $this->createLayer($project, $pm1);

        $zone = Zone::query()->create([
            'layer_id' => $layer->id,
            'zone_code' => 'PRJ_T1_KT_001',
            'name' => 'Z1',
            'geometry_pct' => $this->geometry(),
            'status' => 'in_progress',
            'completion_pct' => 30,
            'assigned_user_id' => $assignedField->id,
            'deadline' => now()->addDays(2)->toDateString(),
            'created_by' => $pm1->id,
        ]);

        $this->artisan('tiendo:check-deadlines')->assertExitCode(0);

        Notification::query()
            ->where('type', 'deadline_approaching')
            ->where('data->zone_id', (int) $zone->id)
            ->update(['read_at' => now()]);

        $this->artisan('tiendo:check-deadlines')->assertExitCode(0);

        $count = Notification::query()
            ->where('type', 'deadline_approaching')
            ->where('data->zone_id', (int) $zone->id)
            ->count();
        $this->assertSame(6, $count);
    }

    /**
     * @return array{0: Project, 1: User, 2: User, 3: User, 4: User}
     */
    private function createProjectContext(): array
    {
        [$project, $pm1, $pm2, $assignedField] = $this->createProjectContextWithoutViewer();

        $viewer = User::factory()->create([
            'role' => 'viewer',
            'is_active' => true,
        ]);

        ProjectMember::query()->create([
            'project_id' => $project->id,
            'user_id' => $viewer->id,
            'role' => 'viewer',
            'created_at' => now(),
        ]);

        return [$project, $pm1, $pm2, $assignedField, $viewer];
    }

    /**
     * @return array{0: Project, 1: User, 2: User, 3: User}
     */
    private function createProjectContextWithoutViewer(): array
    {
        $pm1 = User::factory()->create([
            'role' => 'project_manager',
            'is_active' => true,
        ]);
        $pm2 = User::factory()->create([
            'role' => 'project_manager',
            'is_active' => true,
        ]);
        $assignedField = User::factory()->create([
            'role' => 'field_team',
            'is_active' => true,
        ]);

        $project = Project::query()->create([
            'name' => 'P',
            'code' => 'PRJ',
            'created_by' => $pm1->id,
        ]);

        foreach ([[$pm1, 'project_manager'], [$pm2, 'project_manager'], [$assignedField, 'field_team']] as [$user, $role]) {
            ProjectMember::query()->create([
                'project_id' => $project->id,
                'user_id' => $user->id,
                'role' => $role,
                'created_at' => now(),
            ]);
        }

        return [$project, $pm1, $pm2, $assignedField];
    }

    private function createLayer(Project $project, User $uploadedBy): Layer
    {
        $masterLayer = MasterLayer::query()->create([
            'project_id' => $project->id,
            'name' => 'ML',
            'code' => 'T1',
            'sort_order' => 1,
        ]);

        return Layer::query()->create([
            'master_layer_id' => $masterLayer->id,
            'name' => 'L',
            'code' => 'KT',
            'type' => 'architecture',
            'status' => 'ready',
            'sort_order' => 1,
            'original_filename' => 'a.pdf',
            'file_path' => 'layers/1/original.pdf',
            'tile_path' => 'layers/1/tiles',
            'file_size' => 1,
            'width_px' => 1000,
            'height_px' => 1000,
            'retry_count' => 0,
            'next_zone_seq' => 1,
            'uploaded_by' => $uploadedBy->id,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function geometry(): array
    {
        return [
            'type' => 'polygon',
            'points' => [
                ['x' => 0.1, 'y' => 0.1],
                ['x' => 0.2, 'y' => 0.1],
                ['x' => 0.2, 'y' => 0.2],
            ],
        ];
    }
}
