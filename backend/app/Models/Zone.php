<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Zone extends Model
{
    protected $fillable = [
        'layer_id',
        'zone_code',
        'name',
        'name_full',
        'geometry_pct',
        'status',
        'completion_pct',
        'assignee',
        'assigned_user_id',
        'deadline',
        'tasks',
        'notes',
        'area_px',
        'auto_detected',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'geometry_pct' => 'array',
            'completion_pct' => 'integer',
            'deadline' => 'date',
            'area_px' => 'float',
            'auto_detected' => 'boolean',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function layer(): BelongsTo
    {
        return $this->belongsTo(Layer::class);
    }

    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_user_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function marks(): HasMany
    {
        return $this->hasMany(Mark::class);
    }

    public function comments(): HasMany
    {
        return $this->hasMany(ZoneComment::class, 'zone_id');
    }
}
