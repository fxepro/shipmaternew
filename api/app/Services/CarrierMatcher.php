<?php

namespace App\Services;

use App\Models\Capability;
use App\Models\CarrierVehicle;
use App\Models\FreightJob;
use App\Models\Organization;
use Illuminate\Support\Facades\DB;

/**
 * Which carriers can haul a load, and why not.
 *
 * A carrier fits when, all at once:
 *  - it holds carrier authority in good standing (active, auto insurance not lapsed);
 *  - one of its active vehicles (its own, or leased on under its authority) has an accepted equipment type,
 *    every required feature, enough payload for the load weight, and the load's temperature range;
 *  - it has every required specialization (service type);
 *  - hazmat: its authority is hazmat-authorized and one of its drivers holds an H or X endorsement;
 *  - any required endorsement is held by one of its drivers.
 *
 * A missing value on the carrier's side (no payload or temperature range on file) does not rule it out;
 * it lowers the score and is listed under "unknown".
 */
class CarrierMatcher
{
    /** Everything about a carrier the rules need, loaded once */
    public function context(Organization $org): array
    {
        $authorities = $org->authorities()->where('kind', 'carrier')->get();
        $vehicles = CarrierVehicle::where('status', 'active')
            ->where(fn ($q) => $q->where('carrier_id', $org->id)->orWhereIn('operating_authority_id', $authorities->pluck('id')))
            ->get();
        $features = DB::table('vehicle_capabilities')->whereIn('vehicle_id', $vehicles->pluck('id'))->get()
            ->groupBy('vehicle_id')->map(fn ($rows) => $rows->pluck('capability_key')->all());
        // Endorsements held by anyone at the carrier (the owner-operator included), from their CDL credentials
        $driverIds = DB::table('org_members')->where('org_id', $org->id)->where('status', 'active')->pluck('user_id');
        $endorsements = collect(\App\Support\Endorsements::forUsers($driverIds))->flatten()->unique()->values()->all();

        return [
            'org'          => $org,
            'authorities'  => $authorities,
            'vehicles'     => $vehicles,
            'features'     => $features,
            'services'     => $org->serviceTypes()->pluck('key')->all(),
            'endorsements' => $endorsements,
        ];
    }

    /** @return array{fit: bool, score: int, misses: string[], unknown: string[], vehicle_ids: int[]} */
    public function evaluate(FreightJob $job, array $ctx): array
    {
        $misses = [];
        $unknown = [];
        $names = $this->names();

        $authority = $ctx['authorities']->first(fn ($a) => $a->inGoodStanding());
        if (!$authority) $misses[] = 'No carrier authority in good standing';

        // Vehicles
        $equip = $job->equipment_types ?? [];
        $featuresNeeded = array_values(array_intersect($job->required_capabilities ?? [], $this->kindKeys('feature')));
        $weight = (int) ($job->total_weight_lbs ?? 0);
        $fitting = [];
        $vehicleMiss = [];
        foreach ($ctx['vehicles'] as $v) {
            $why = [];
            $vUnknown = [];
            if ($equip && !in_array($v->equipment_type, $equip, true)) $why[] = 'equipment';
            $have = $ctx['features'][$v->id] ?? [];
            $lacking = array_diff($featuresNeeded, $have);
            if ($lacking) $why[] = 'features';
            if ($weight > 0) {
                if ($v->max_payload === null) $vUnknown[] = 'payload';
                elseif ((float) $v->max_payload < $weight) $why[] = 'payload';
            }
            if ($job->temp_min_f !== null || $job->temp_max_f !== null) {
                if ($v->temp_min_f === null && $v->temp_max_f === null) $vUnknown[] = 'temperature';
                elseif (($job->temp_min_f !== null && $v->temp_min_f !== null && $v->temp_min_f > $job->temp_min_f)
                     || ($job->temp_max_f !== null && $v->temp_max_f !== null && $v->temp_max_f < $job->temp_max_f)) $why[] = 'temperature';
            }
            if (!$why) $fitting[$v->id] = $vUnknown;
            else foreach ($why as $w) $vehicleMiss[$w] = true;
        }
        if ($ctx['vehicles']->isEmpty()) {
            $misses[] = 'No active vehicles on file';
        } elseif (!$fitting) {
            $parts = [];
            if (isset($vehicleMiss['equipment'])) $parts[] = 'equipment (' . implode(' / ', array_map(fn ($k) => $names[$k] ?? $k, $equip)) . ')';
            if (isset($vehicleMiss['features'])) $parts[] = 'features (' . implode(', ', array_map(fn ($k) => $names[$k] ?? $k, $featuresNeeded)) . ')';
            if (isset($vehicleMiss['payload'])) $parts[] = 'payload for ' . number_format($weight) . ' lbs';
            if (isset($vehicleMiss['temperature'])) $parts[] = 'temperature range';
            $misses[] = 'No vehicle with the right ' . implode(', ', $parts);
        } else {
            // Best vehicle: the one with the fewest unknowns
            $best = collect($fitting)->sortBy(fn ($u) => count($u))->first();
            foreach ($best as $u) $unknown[] = $u === 'payload' ? 'Vehicle payload not on file' : 'Vehicle temperature range not on file';
        }

        // Specializations
        foreach (array_diff($job->required_service_types ?? [], $ctx['services']) as $s) {
            $misses[] = 'Not set up for ' . ($this->serviceNames()[$s] ?? $s);
        }

        // Hazmat
        if ($job->hazmat) {
            if ($authority && !$ctx['authorities']->contains(fn ($a) => $a->hazmat_authorized && $a->inGoodStanding())) $misses[] = 'Authority not hazmat-authorized';
            if (!array_intersect(['endorse_h', 'endorse_x'], $ctx['endorsements'])) $misses[] = 'No driver with a hazmat (H or X) endorsement';
        }

        // Endorsements
        foreach (array_diff(array_intersect($job->required_capabilities ?? [], $this->kindKeys('endorsement')), $ctx['endorsements']) as $e) {
            $misses[] = 'No driver with endorsement ' . ($names[$e] ?? $e);
        }

        $score = 100 - 10 * count($unknown);
        $org = $ctx['org'];
        if ($org->verification_status === 'approved') $score += 10;
        if ($org->rating) $score += (int) round((float) $org->rating * 2);

        return [
            'fit'         => !$misses,
            'score'       => $misses ? 0 : $score,
            'misses'      => $misses,
            'unknown'     => $unknown,
            'vehicle_ids' => array_keys($fitting),
        ];
    }

    public function check(FreightJob $job, Organization $org): array
    {
        return $this->evaluate($job, $this->context($org));
    }

    /** Carriers ranked for a load. $all includes the ones that don't fit, with reasons. */
    public function forJob(FreightJob $job, bool $all = false, int $limit = 50): array
    {
        $q = Organization::where('type', 'carrier')->where('status', 'active')->whereNotNull('owner_id');
        $equip = $job->equipment_types ?? [];
        if ($equip && !$all) {
            // Cheap pre-filter: has a vehicle of an accepted type (own or under its authority)
            $q->where(function ($w) use ($equip) {
                $w->whereIn('id', CarrierVehicle::whereIn('equipment_type', $equip)->where('status', 'active')->select('carrier_id'))
                  ->orWhereIn('id', DB::table('operating_authorities')->whereIn('id',
                      CarrierVehicle::whereIn('equipment_type', $equip)->where('status', 'active')->whereNotNull('operating_authority_id')->select('operating_authority_id'))->select('org_id'));
            });
        }

        $rows = [];
        foreach ($q->get() as $org) {
            $r = $this->evaluate($job, $this->context($org));
            if (!$r['fit'] && !$all) continue;
            $rows[] = ['carrier' => ['id' => $org->id, 'name' => $org->name, 'city' => $org->city, 'state' => $org->state,
                'verification_status' => $org->verification_status, 'rating' => $org->rating]] + $r;
        }
        usort($rows, fn ($a, $b) => [$b['fit'], $b['score']] <=> [$a['fit'], $a['score']]);
        return array_slice($rows, 0, $limit);
    }

    private ?array $names = null;
    private ?array $serviceNames = null;

    private function names(): array
    {
        return $this->names ??= Capability::pluck('name', 'key')->all();
    }

    private function serviceNames(): array
    {
        return $this->serviceNames ??= DB::table('service_types')->pluck('name', 'key')->all();
    }

    private array $kinds = [];

    private function kindKeys(string $kind): array
    {
        return $this->kinds[$kind] ??= Capability::where('kind', $kind)->pluck('key')->all();
    }
}
