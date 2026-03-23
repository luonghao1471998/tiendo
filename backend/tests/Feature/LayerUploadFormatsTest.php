<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Jobs\ProcessPdfJob;
use App\Models\Layer;
use App\Models\MasterLayer;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Bus;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LayerUploadFormatsTest extends TestCase
{
    use RefreshDatabase;

    public function test_rejects_non_drawing_extension(): void
    {
        [$pm, , $masterLayer] = $this->createPmProjectAndMasterLayer();
        Sanctum::actingAs($pm);

        Bus::fake();

        $this->post('/api/v1/master-layers/'.$masterLayer->id.'/layers', [
            'name' => 'Layer A',
            'code' => 'LA',
            'type' => 'architecture',
            'file' => UploadedFile::fake()->create('notes.txt', 10),
        ])->assertStatus(422);

        Bus::assertNothingDispatched();
    }

    public function test_accepts_dxf_and_dispatches_job(): void
    {
        [$pm, , $masterLayer] = $this->createPmProjectAndMasterLayer();
        Sanctum::actingAs($pm);

        Bus::fake();

        $response = $this->post('/api/v1/master-layers/'.$masterLayer->id.'/layers', [
            'name' => 'CAD Layer',
            'code' => 'CAD1',
            'type' => 'architecture',
            'file' => UploadedFile::fake()->create('floor.dxf', 50),
        ]);

        $response->assertCreated()
            ->assertJsonPath('success', true);

        $id = (int) $response->json('data.id');
        $layer = Layer::query()->findOrFail($id);
        $this->assertSame('layers/'.$id.'/original.dxf', $layer->file_path);

        Bus::assertDispatched(ProcessPdfJob::class);
    }

    public function test_accepts_pdf_and_stores_original_pdf(): void
    {
        [$pm, , $masterLayer] = $this->createPmProjectAndMasterLayer();
        Sanctum::actingAs($pm);

        Bus::fake();

        $response = $this->post('/api/v1/master-layers/'.$masterLayer->id.'/layers', [
            'name' => 'PDF Layer',
            'code' => 'P1',
            'type' => 'architecture',
            'file' => UploadedFile::fake()->create('plan.pdf', 100),
        ]);

        $response->assertCreated();

        $id = (int) $response->json('data.id');
        $layer = Layer::query()->findOrFail($id);
        $this->assertSame('layers/'.$id.'/original.pdf', $layer->file_path);

        Bus::assertDispatched(ProcessPdfJob::class);
    }

    /**
     * @return array{0: User, 1: Project, 2: MasterLayer}
     */
    private function createPmProjectAndMasterLayer(): array
    {
        $pm = User::factory()->create([
            'role' => 'project_manager',
            'is_active' => true,
        ]);

        $project = Project::query()->create([
            'name' => 'Upload formats project',
            'code' => 'UFP'.rand(1000, 9999),
            'created_by' => $pm->id,
        ]);

        ProjectMember::query()->create([
            'project_id' => $project->id,
            'user_id' => $pm->id,
            'role' => 'project_manager',
            'created_at' => now(),
        ]);

        $masterLayer = MasterLayer::query()->create([
            'project_id' => $project->id,
            'name' => 'Tầng 1',
            'code' => 'T1',
            'sort_order' => 1,
        ]);

        return [$pm, $project, $masterLayer];
    }
}
