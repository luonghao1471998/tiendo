<?php

declare(strict_types=1);

namespace App\Services;

use App\Jobs\ProcessPdfJob;
use App\Models\Layer;
use App\Models\MasterLayer;
use App\Models\User;
use App\Repositories\LayerRepository;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class LayerService
{
    public function __construct(private readonly LayerRepository $layerRepository)
    {
    }

    public function upload(MasterLayer $masterLayer, User $user, array $data, UploadedFile $file): Layer
    {
        $code = strtoupper((string) $data['code']);

        if ($this->layerRepository->existsCodeForMasterLayer($masterLayer, $code)) {
            throw ValidationException::withMessages([
                'code' => ['Mã layer đã tồn tại trong mặt bằng này.'],
            ]);
        }

        $disk = Storage::disk('local');

        $layer = DB::transaction(function () use ($masterLayer, $user, $data, $file, $code, $disk) {
            $layer = $this->layerRepository->create([
                'master_layer_id' => $masterLayer->id,
                'name' => $data['name'],
                'code' => $code,
                'type' => $data['type'],
                'status' => 'uploading',
                'sort_order' => $data['sort_order'] ?? 0,
                'original_filename' => $file->getClientOriginalName(),
                'file_path' => '__pending__',
                'tile_path' => null,
                'file_size' => $file->getSize(),
                'uploaded_by' => $user->id,
            ]);

            $relative = 'layers/'.$layer->id.'/original.pdf';
            $disk->put($relative, file_get_contents($file->getRealPath()) ?: '');

            $this->layerRepository->update($layer, [
                'file_path' => $relative,
            ]);

            return $layer->fresh();
        });

        if ($layer instanceof Layer) {
            ProcessPdfJob::dispatch($layer);
        }

        return $layer;
    }

    /**
     * @return \Illuminate\Database\Eloquent\Collection<int, Layer>
     */
    public function listForMasterLayer(MasterLayer $masterLayer)
    {
        return $this->layerRepository->listForMasterLayer($masterLayer);
    }

    /**
     * Dữ liệu tối thiểu cho client polling (sync layer / canvas).
     *
     * @return array<string, mixed>
     */
    public function getSyncData(Layer $layer): array
    {
        $layer->refresh();

        return [
            'id' => $layer->id,
            'status' => $layer->status,
            'updated_at' => $layer->updated_at?->toIso8601String(),
            'width_px' => $layer->width_px,
            'height_px' => $layer->height_px,
            'retry_count' => $layer->retry_count,
            'error_message' => $layer->error_message,
            'processed_at' => $layer->processed_at?->toIso8601String(),
        ];
    }

    public function retryProcessing(Layer $layer): void
    {
        if ($layer->status !== 'failed') {
            throw ValidationException::withMessages([
                'status' => ['Chỉ có thể retry khi layer đang ở trạng thái failed.'],
            ]);
        }

        if ($layer->retry_count >= 3) {
            throw ValidationException::withMessages([
                'retry_count' => ['Đã vượt quá số lần retry cho phép.'],
            ]);
        }

        $this->layerRepository->update($layer, [
            'status' => 'processing',
            'error_message' => null,
        ]);

        ProcessPdfJob::dispatch($layer->fresh());
    }

    public function delete(Layer $layer): void
    {
        $id = $layer->id;
        $disk = Storage::disk('local');
        $prefix = 'layers/'.$id;

        if ($disk->exists($prefix)) {
            $disk->deleteDirectory($prefix);
        }

        $this->layerRepository->delete($layer);
    }
}
