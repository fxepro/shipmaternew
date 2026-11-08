<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One compliance item a company keeps on file (see App\Support\ComplianceRules) */
class OrgComplianceItem extends Model
{
    protected $fillable = ['org_id', 'key', 'value', 'file_path', 'file_name', 'expires_at', 'verified_at', 'verified_by', 'uploaded_by'];

    protected function casts(): array
    {
        return ['expires_at' => 'date', 'verified_at' => 'datetime'];
    }

    public function org(): BelongsTo
    {
        return $this->belongsTo(Organization::class, 'org_id');
    }
}
