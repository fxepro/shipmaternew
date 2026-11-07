<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Someone asking to take over a listed organization (see App\Services\OrgDirectory::approveClaim) */
class OrgClaim extends Model
{
    protected $fillable = ['org_id', 'user_id', 'as_type', 'status', 'method', 'note', 'decided_by', 'decided_at'];

    protected function casts(): array
    {
        return ['decided_at' => 'datetime'];
    }

    public function org(): BelongsTo  { return $this->belongsTo(Organization::class, 'org_id'); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}
