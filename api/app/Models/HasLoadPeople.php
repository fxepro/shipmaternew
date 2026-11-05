<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Shared by shipments and freight jobs. shipper_id and carrier_id are companies;
 * the people on the load are rows in load_people.
 */
trait HasLoadPeople
{
    abstract public function loadType(): string;

    public function shipper(): BelongsTo { return $this->belongsTo(Organization::class, 'shipper_id'); }
    public function carrier(): BelongsTo { return $this->belongsTo(Organization::class, 'carrier_id'); }

    public function people(): HasMany
    {
        return $this->hasMany(LoadPerson::class, 'load_id')->where('load_type', $this->loadType());
    }

    /** Record a person from one of the two companies on this load */
    public function addPerson(?int $orgId, ?int $userId, ?int $addedBy = null): void
    {
        LoadPerson::add($this->loadType(), $this->id, $orgId, $userId, $addedBy);
    }

    /** The carrier's drivers on this load */
    public function drivers()
    {
        return User::whereIn('id', LoadPerson::drivers($this->loadType(), $this->id, $this->carrier_id)->select('user_id'));
    }

    /** Loads where the company is the shipper or the carrier */
    public function scopeForOrg(Builder $q, ?int $orgId): Builder
    {
        return $q->where(fn ($w) => $w->where('shipper_id', $orgId)->orWhere('carrier_id', $orgId));
    }

    /** Loads a person is on */
    public function scopeForPerson(Builder $q, int $userId): Builder
    {
        return $q->whereIn('id', LoadPerson::where('load_type', $this->loadType())->where('user_id', $userId)->select('load_id'));
    }
}
