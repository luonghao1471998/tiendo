<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ActivityLog extends Model
{
    public $timestamps = false;

    public const UPDATED_AT = null;

    protected $fillable = [
        'target_type',
        'target_id',
        'action',
        'snapshot_before',
        'changes',
        'restored_from_log_id',
        'user_id',
        'user_name',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'target_id' => 'integer',
            'snapshot_before' => 'array',
            'changes' => 'array',
            'restored_from_log_id' => 'integer',
            'user_id' => 'integer',
            'created_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
