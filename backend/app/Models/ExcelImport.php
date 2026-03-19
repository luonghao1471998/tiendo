<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExcelImport extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'layer_id',
        'filename',
        'file_path',
        'status',
        'column_mapping',
        'preview_data',
        'result_data',
        'imported_by',
        'created_at',
        'applied_at',
    ];

    protected function casts(): array
    {
        return [
            'column_mapping' => 'array',
            'preview_data' => 'array',
            'result_data' => 'array',
            'created_at' => 'datetime',
            'applied_at' => 'datetime',
        ];
    }

    public function layer(): BelongsTo
    {
        return $this->belongsTo(Layer::class);
    }

    public function importer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'imported_by');
    }
}
