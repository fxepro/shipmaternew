<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A person to reach at an organization, for the whole company or one location: a warehouse manager,
 * a receiving lead. Each contact picks which load updates they get and how (notify).
 */
class OrgContact extends Model
{
    /** Load updates a contact can get, for loads with a stop at their location (or any of the company's locations) */
    public const EVENTS = [
        'booked'   => 'A carrier is booked for a load to or from here',
        'en_route' => 'The truck is on its way to this stop',
        'arrived'  => 'The truck has arrived',
        'done'     => 'Picked up or delivered',
    ];
    public const CHANNELS = ['email', 'sms'];

    /** New contacts get email when a load is booked, on the way and done */
    public const DEFAULT_NOTIFY = ['booked' => ['email'], 'en_route' => ['email'], 'arrived' => [], 'done' => ['email']];

    protected $fillable = [
        'org_id', 'location_id', 'user_id', 'name', 'title', 'phone', 'mobile', 'email',
        'is_primary', 'notify', 'notes', 'created_by_org_id',
    ];

    protected function casts(): array
    {
        return ['notify' => 'array', 'is_primary' => 'boolean'];
    }

    public function org(): BelongsTo      { return $this->belongsTo(Organization::class, 'org_id'); }
    public function location(): BelongsTo { return $this->belongsTo(Location::class); }

    /** Channels this contact wants for an event */
    public function channelsFor(string $event): array
    {
        return array_values(array_intersect((array) (($this->notify ?? self::DEFAULT_NOTIFY)[$event] ?? []), self::CHANNELS));
    }

    /** Keep only known events and channels */
    public static function cleanNotify(?array $notify): array
    {
        $out = [];
        foreach (array_keys(self::EVENTS) as $e) {
            $out[$e] = array_values(array_intersect((array) ($notify[$e] ?? []), self::CHANNELS));
        }
        return $out;
    }
}
