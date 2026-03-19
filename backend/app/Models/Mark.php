<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Mark extends Model
{
    protected $fillable = [
        'zone_id',
        'geometry_pct',
        'status',
        'note',
        'painted_by',
    ];

    protected function casts(): array
    {
        return [
            'geometry_pct' => 'array',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function zone(): BelongsTo
    {
        return $this->belongsTo(Zone::class);
    }

    public function painter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'painted_by');
    }
}
