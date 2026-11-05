<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CarrierVerification extends Model
{
    protected $fillable = [
        'carrier_id', 'user_id', 'check_type', 'status',
        'result_data', 'external_id', 'admin_notes',
        'reviewed_by', 'reviewed_at', 'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'result_data' => 'json',
            'reviewed_at' => 'datetime',
            'expires_at'  => 'datetime',
        ];
    }

    /** Company checks (FMCSA, MC) */
    public function carrier(): BelongsTo
    {
        return $this->belongsTo(Organization::class, 'carrier_id');
    }

    /** Person checks (identity, background) */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
