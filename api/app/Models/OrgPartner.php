<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** An organization a company keeps in its own list: a shipper's receivers */
class OrgPartner extends Model
{
    public const RELATIONS = ['receiver', 'broker'];

    protected $fillable = ['org_id', 'partner_org_id', 'relation', 'added_by', 'notes'];

    public function org(): BelongsTo     { return $this->belongsTo(Organization::class, 'org_id'); }
    public function partner(): BelongsTo { return $this->belongsTo(Organization::class, 'partner_org_id'); }
}
