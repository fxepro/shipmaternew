<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A person working on a load: the shipper's dispatcher, the carrier's driver, and so on.
 * org_id is their company and user_id the person; their role comes from org_members.
 */
class LoadPerson extends Model
{
    protected $table = 'load_people';

    protected $fillable = ['load_type', 'load_id', 'org_id', 'user_id', 'added_by'];

    public function org(): BelongsTo  { return $this->belongsTo(Organization::class, 'org_id'); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }

    /** Record a person on a load (once) */
    public static function add(string $loadType, int $loadId, ?int $orgId, ?int $userId, ?int $addedBy = null): void
    {
        if (!$orgId || !$userId) return;
        self::firstOrCreate(
            ['load_type' => $loadType, 'load_id' => $loadId, 'user_id' => $userId],
            ['org_id' => $orgId, 'added_by' => $addedBy],
        );
    }

    /** The rows for one company's drivers on a load (role driver in org_members) */
    public static function drivers(string $loadType, int $loadId, ?int $orgId)
    {
        return self::where('load_type', $loadType)->where('load_id', $loadId)->where('org_id', $orgId)
            ->whereIn('user_id', OrgMember::where('org_id', $orgId)->drivers()->select('user_id'));
    }
}
