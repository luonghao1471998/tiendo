<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
class Layer extends Model
{
    protected $fillable = [
        'master_layer_id',
        'name',
        'code',
        'type',
        'status',
        'sort_order',
        'original_filename',
        'file_path',
        'tile_path',
        'file_size',
        'width_px',
        'height_px',
        'retry_count',
        'error_message',
        'processed_at',
        'next_zone_seq',
        'uploaded_by',
    ];

    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
            'file_size' => 'integer',
            'width_px' => 'integer',
            'height_px' => 'integer',
            'retry_count' => 'integer',
            'next_zone_seq' => 'integer',
            'processed_at' => 'datetime',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function masterLayer(): BelongsTo
    {
        return $this->belongsTo(MasterLayer::class);
    }

    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function zones(): HasMany
    {
        return $this->hasMany(Zone::class);
    }
}

