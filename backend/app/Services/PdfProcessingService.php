<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Layer;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class PdfProcessingService
{
    /**
     * Chạy Python pdf_processor.py, parse stdout JSON.
     *
     * @return array{width_px: int, height_px: int, tiles_generated: int}
     */
    public function processToTiles(Layer $layer): array
    {
        $disk = Storage::disk('local');
        $inputPath = $disk->path($layer->file_path);

        if (! is_file($inputPath)) {
            throw new RuntimeException('PDF file not found on disk.');
        }

        $tileRelative = 'layers/'.$layer->id.'/tiles';
        $outputDir = $disk->path($tileRelative);

        if (! is_dir($outputDir)) {
            if (! mkdir($outputDir, 0755, true) && ! is_dir($outputDir)) {
                throw new RuntimeException('Cannot create tiles output directory.');
            }
        }

        $python = env('PYTHON_BIN', 'python3');
        $script = base_path('scripts/pdf_processor.py');
        $tileSize = (int) env('PDF_TILE_SIZE', 1024);
        $dpi = (int) env('PDF_DPI', 150);

        if (! is_file($script)) {
            throw new RuntimeException('pdf_processor.py not found at '.$script);
        }

        $result = Process::timeout(120)
            ->run([
                $python,
                $script,
                '--input',
                $inputPath,
                '--output-dir',
                $outputDir,
                '--tile-size',
                (string) $tileSize,
                '--dpi',
                (string) $dpi,
            ]);

        $stdout = trim($result->output());
        $decoded = $this->parseStdoutJson($stdout);

        if (is_array($decoded) && array_key_exists('success', $decoded) && $decoded['success'] === false) {
            $message = is_string($decoded['error'] ?? null)
                ? $decoded['error']
                : 'PDF processing failed.';

            throw new RuntimeException($message);
        }

        if (! is_array($decoded) || empty($decoded['success'])) {
            throw new RuntimeException(
                'Invalid processor output: '.$stdout.' | stderr: '.trim($result->errorOutput())
            );
        }

        if (! $result->successful()) {
            throw new RuntimeException(
                'Processor exited with code '.$result->exitCode().': '.trim($result->errorOutput())
            );
        }

        return [
            'width_px' => (int) ($decoded['width_px'] ?? 0),
            'height_px' => (int) ($decoded['height_px'] ?? 0),
            'tiles_generated' => (int) ($decoded['tiles_generated'] ?? 0),
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function parseStdoutJson(string $stdout): ?array
    {
        $lines = preg_split("/\r\n|\n|\r/", $stdout) ?: [];
        $lines = array_values(array_filter(array_map('trim', $lines)));

        for ($i = count($lines) - 1; $i >= 0; $i--) {
            $line = $lines[$i];
            if ($line === '') {
                continue;
            }
            $decoded = json_decode($line, true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }

        return null;
    }
}
