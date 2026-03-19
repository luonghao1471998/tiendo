<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\Layer;
use App\Repositories\LayerRepository;
use App\Services\PdfProcessingService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

class ProcessPdfJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $timeout = 120;

    public int $tries = 3;

    public function __construct(public Layer $layer)
    {
        $this->onQueue('pdf-processing');
    }

    /**
     * @return array<int, int>
     */
    public function backoff(): array
    {
        return [30, 60, 120];
    }

    public function handle(PdfProcessingService $pdfProcessingService, LayerRepository $layerRepository): void
    {
        $layer = Layer::query()->find($this->layer->id);

        if ($layer === null) {
            return;
        }

        if ($layer->status === 'ready') {
            return;
        }

        $layerRepository->update($layer, ['status' => 'processing']);

        try {
            $result = $pdfProcessingService->processToTiles($layer);

            $layerRepository->update($layer, [
                'status' => 'ready',
                'width_px' => $result['width_px'],
                'height_px' => $result['height_px'],
                'tile_path' => 'layers/'.$layer->id.'/tiles',
                'processed_at' => now(),
                'error_message' => null,
                'retry_count' => 0,
            ]);
        } catch (Throwable $e) {
            $layer->refresh();

            $retryCount = $layer->retry_count + 1;
            $payload = [
                'retry_count' => $retryCount,
                'error_message' => $e->getMessage(),
            ];

            if ($retryCount >= 3) {
                $payload['status'] = 'failed';
                $layerRepository->update($layer, $payload);

                return;
            }

            $layerRepository->update($layer, array_merge($payload, [
                'status' => 'processing',
            ]));

            throw $e;
        }
    }

    public function failed(?Throwable $exception): void
    {
        $layer = Layer::query()->find($this->layer->id);

        if ($layer === null || $layer->status === 'ready') {
            return;
        }

        if ($layer->status === 'failed') {
            return;
        }

        app(LayerRepository::class)->update($layer, [
            'status' => 'failed',
            'error_message' => $exception?->getMessage() ?? 'ProcessPdfJob failed.',
        ]);
    }
}
