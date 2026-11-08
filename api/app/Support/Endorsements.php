<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

/**
 * CDL endorsements live in one place: the person's credentials (person_credentials), entered with their CDL
 * under Driving credentials. Matching and the professional profile read them from here.
 * X (tank + hazmat) counts when a person holds both H and N.
 */
class Endorsements
{
    /** credential type => capability key */
    public const CREDENTIALS = [
        'hazmat_endorsement'          => 'endorse_h',
        'tanker_endorsement'          => 'endorse_n',
        'passenger_endorsement'       => 'endorse_p',
        'doubles_triples_endorsement' => 'endorse_t',
        'school_bus_endorsement'      => 'endorse_s',
    ];

    /** @return array<int, string[]> user_id => capability keys (current, not expired) */
    public static function forUsers(iterable $userIds): array
    {
        $ids = collect($userIds)->filter()->unique()->values();
        if ($ids->isEmpty()) return [];
        $rows = DB::table('person_credentials')->whereIn('user_id', $ids)->whereIn('type', array_keys(self::CREDENTIALS))
            ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>=', now()->toDateString()))
            ->get(['user_id', 'type']);
        $out = [];
        foreach ($rows as $r) {
            $out[$r->user_id][] = self::CREDENTIALS[$r->type];
        }
        foreach ($out as $uid => $keys) {
            $keys = array_values(array_unique($keys));
            if (in_array('endorse_h', $keys, true) && in_array('endorse_n', $keys, true)) $keys[] = 'endorse_x';
            $out[$uid] = $keys;
        }
        return $out;
    }

    public static function forUser(int $userId): array
    {
        return self::forUsers([$userId])[$userId] ?? [];
    }
}
