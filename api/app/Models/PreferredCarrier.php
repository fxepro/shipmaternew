<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PreferredCarrier extends Model
{
    protected $fillable = ['shipper_id', 'carrier_id', 'status'];

    public function shipper(): BelongsTo { return $this->belongsTo(Organization::class, 'shipper_id'); }
    public function carrier(): BelongsTo { return $this->belongsTo(Organization::class, 'carrier_id'); }
}
