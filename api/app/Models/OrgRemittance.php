<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** How a company is paid outside Shipmater (bank, wire, check, remittance contact). */
class OrgRemittance extends Model
{
    protected $table = 'org_remittance';

    protected $fillable = [
        'org_id', 'payee_name',
        'bank_name', 'routing_number', 'account_number', 'account_type',
        'wire_routing_number',
        'check_payable_to', 'check_street', 'check_city', 'check_state', 'check_zip',
        'remittance_email', 'remittance_phone', 'instructions',
        'billing_name', 'billing_email', 'billing_phone',
        'updated_by',
    ];

    protected $hidden = ['account_number'];

    protected function casts(): array
    {
        return ['account_number' => 'encrypted'];
    }

    protected static function booted(): void
    {
        static::saving(function (OrgRemittance $r) {
            if ($r->isDirty('account_number')) {
                $r->account_last4 = $r->account_number ? substr(preg_replace('/\D/', '', $r->account_number), -4) : null;
            }
        });
    }

    public function org(): BelongsTo
    {
        return $this->belongsTo(Organization::class, 'org_id');
    }
}
