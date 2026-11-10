<?php

namespace App\Services\Rates;

use App\Models\FreightJob;
use App\Services\GeocodingService;
use App\Services\RoutingService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Market rate guidance (Rate check, and the rate step of Post a load).
 *
 * Shipmater's own estimate: road miles × the per-mile rate for the equipment (set by admins in Settings,
 * never made up here), plus a fuel surcharge from the weekly US diesel price (EIA), plus extras for hazmat,
 * temperature control and extra stops. When Shipmater has enough completed loads on the same lane and
 * equipment, what they actually paid is blended in. Licensed lane data (DAT, Greenscreens) can replace
 * the estimate later behind the provider setting.
 */
class RateEstimator
{
    /** Completed loads on a lane before their prices are blended in */
    public const HISTORY_MIN = 5;

    public static function settings(): array
    {
        $saved = Cache::remember('rate_settings', 300, fn () => json_decode((string) DB::table('platform_settings')->where('key', 'rates')->value('value'), true) ?: []);
        return array_replace_recursive([
            'provider'        => 'shipmater',
            'per_mile'        => [],     // equipment key => dollars a mile, set by admins
            'min_charge'      => null,   // dollars, the lowest a load is priced at
            'spread_pct'      => 10,     // the low and high ends either side of typical
            'hazmat_pct'      => null,   // percent added to linehaul for hazmat
            'temp_pct'        => null,   // percent added for temperature control (not for reefer, whose rate includes it)
            'extra_stop'      => null,   // dollars for each stop beyond one pickup and one drop-off
            'fuel_base_price' => null,   // diesel price a gallon already included in the per-mile rates
            'fuel_mpg'        => null,   // miles a gallon used for the surcharge
        ], $saved);
    }

    public static function save(array $settings, ?int $userId): array
    {
        DB::table('platform_settings')->updateOrInsert(['key' => 'rates'], ['value' => json_encode($settings), 'updated_by' => $userId, 'updated_at' => now()]);
        Cache::forget('rate_settings');
        return self::settings();
    }

    /**
     * $in: origin and destination (['city','state'] and optional 'lat','lng'), equipment, miles (optional),
     * hazmat, temp_controlled, extra_stops. Returns the range in cents with the lines it is made of.
     */
    public function estimate(array $in): array
    {
        $set = self::settings();
        $equipment = $in['equipment'] ?: 'dry_van';
        $rate = (float) ($set['per_mile'][$equipment] ?? 0);
        if ($rate <= 0) {
            return ['ok' => false, 'reason' => 'No per-mile rate is set for this equipment yet. An admin sets it in Settings, Rate check.'];
        }

        $miles = isset($in['miles']) && $in['miles'] > 0 ? (float) $in['miles'] : $this->miles($in['origin'] ?? [], $in['destination'] ?? []);
        if (!$miles) {
            return ['ok' => false, 'reason' => 'Could not work out the road distance between these places.'];
        }

        $lines = [];
        $linehaul = $rate * $miles;
        $lines[] = ['label' => 'Linehaul', 'detail' => '$' . number_format($rate, 2) . '/mi × ' . number_format($miles) . ' mi', 'cents' => (int) round($linehaul * 100)];

        $fuel = DieselPrice::current();
        if ($fuel && $set['fuel_base_price'] !== null && (float) $set['fuel_mpg'] > 0) {
            $perMile = max(0, ($fuel['price'] - (float) $set['fuel_base_price']) / (float) $set['fuel_mpg']);
            if ($perMile > 0) {
                $lines[] = ['label' => 'Fuel surcharge', 'detail' => '$' . number_format($perMile, 3) . '/mi (diesel $' . number_format($fuel['price'], 3) . ', week of ' . $fuel['period'] . ')', 'cents' => (int) round($perMile * $miles * 100)];
            }
        }
        if (!empty($in['hazmat']) && (float) $set['hazmat_pct'] > 0) {
            $lines[] = ['label' => 'Hazmat', 'detail' => $set['hazmat_pct'] . '% of linehaul', 'cents' => (int) round($linehaul * $set['hazmat_pct']), ];
        }
        if (!empty($in['temp_controlled']) && $equipment !== 'reefer' && (float) $set['temp_pct'] > 0) {
            $lines[] = ['label' => 'Temperature control', 'detail' => $set['temp_pct'] . '% of linehaul', 'cents' => (int) round($linehaul * $set['temp_pct'])];
        }
        $extra = (int) ($in['extra_stops'] ?? 0);
        if ($extra > 0 && (float) $set['extra_stop'] > 0) {
            $lines[] = ['label' => 'Extra stops', 'detail' => $extra . ' × $' . number_format((float) $set['extra_stop'], 2), 'cents' => (int) round($extra * $set['extra_stop'] * 100)];
        }

        $model = array_sum(array_column($lines, 'cents'));
        $min = (int) round(((float) $set['min_charge']) * 100);
        if ($min > 0 && $model < $min) {
            $lines[] = ['label' => 'Minimum charge', 'detail' => 'Brought up to $' . number_format($min / 100, 2), 'cents' => $min - $model];
            $model = $min;
        }

        // What Shipmater's own completed loads on this lane paid
        $history = $this->history($in['origin']['state'] ?? null, $in['destination']['state'] ?? null, $equipment);
        $typical = $model;
        $source = 'Shipmater estimate';
        if ($history['loads'] >= self::HISTORY_MIN) {
            $typical = (int) round(($model + $history['per_mile'] * $miles * 100) / 2);
            $source = "Shipmater estimate blended with {$history['loads']} completed loads on this lane";
        }

        $spread = max(0, (float) $set['spread_pct']) / 100;
        $range = ['low' => (int) round($typical * (1 - $spread)), 'typical' => $typical, 'high' => (int) round($typical * (1 + $spread))];

        return [
            'ok'         => true,
            'miles'      => round($miles, 1),
            'equipment'  => $equipment,
            'total'      => $range,
            'per_mile'   => array_map(fn ($c) => round($c / 100 / $miles, 2), $range),
            'lines'      => $lines,
            'model'      => $model,
            'history'    => $history,
            'fuel'       => $fuel,
            'source'     => $source,
            'confidence' => $history['loads'] >= self::HISTORY_MIN ? 'medium' : 'low',
            'at'         => now()->toISOString(),
        ];
    }

    /** The estimate for a load, from its stops, equipment, hazmat and temperature */
    public function forJob(FreightJob $job): array
    {
        $stops = $job->relationLoaded('stops') ? $job->stops : $job->stops()->get();
        $from = $stops->firstWhere('stop_type', 'pickup');
        $to = $stops->where('stop_type', 'dropoff')->last();
        $place = fn ($s) => $s ? ['city' => $s->city, 'state' => $s->state, 'lat' => $s->lat ? (float) $s->lat : null, 'lng' => $s->lng ? (float) $s->lng : null] : [];

        return $this->estimate([
            'origin'          => $place($from),
            'destination'     => $place($to),
            'miles'           => $job->route_distance_miles ? (float) $job->route_distance_miles : null,
            'equipment'       => collect($job->equipment_types ?? [])->first() ?: 'dry_van',
            'hazmat'          => (bool) $job->hazmat,
            'temp_controlled' => $job->temp_min_f !== null || $job->temp_max_f !== null,
            'extra_stops'     => max(0, $stops->count() - 2),
        ]);
    }

    private function miles(array $from, array $to): ?float
    {
        $point = function (array $p) {
            if (!empty($p['lat']) && !empty($p['lng'])) return [(float) $p['lat'], (float) $p['lng']];
            if (empty($p['city']) && empty($p['zip'])) return null;
            $g = Cache::remember('geo:' . md5(json_encode($p)), 86400 * 30, fn () => app(GeocodingService::class)->geocode('', $p['city'] ?? '', $p['state'] ?? '', $p['zip'] ?? ''));
            return $g ? [$g['lat'], $g['lng']] : null;
        };
        $a = $point($from);
        $b = $point($to);
        if (!$a || !$b) return null;
        $route = Cache::remember('route:' . md5(json_encode([$a, $b])), 86400 * 7, fn () => app(RoutingService::class)->getRoute($a[0], $a[1], $b[0], $b[1]));
        return $route['distance_miles'] ?? null;
    }

    /** Completed loads in the last 120 days from the origin state to the destination state on this equipment */
    private function history(?string $fromState, ?string $toState, string $equipment): array
    {
        if (!$fromState || !$toState) return ['loads' => 0, 'per_mile' => null];
        $rates = FreightJob::where('status', 'completed')->where('completed_at', '>=', now()->subDays(120))
            ->whereNotNull('payment_amount_cents')->where('route_distance_miles', '>', 0)
            ->whereJsonContains('equipment_types', $equipment)
            ->whereHas('stops', fn ($q) => $q->where('stop_type', 'pickup')->where('state', $fromState))
            ->whereHas('stops', fn ($q) => $q->where('stop_type', 'dropoff')->where('state', $toState))
            ->limit(200)->get(['payment_amount_cents', 'route_distance_miles'])
            ->map(fn ($j) => $j->payment_amount_cents / 100 / (float) $j->route_distance_miles)->sort()->values();
        if ($rates->isEmpty()) return ['loads' => 0, 'per_mile' => null];
        $mid = intdiv($rates->count(), 2);
        $median = $rates->count() % 2 ? $rates[$mid] : ($rates[$mid - 1] + $rates[$mid]) / 2;
        return ['loads' => $rates->count(), 'per_mile' => round($median, 2)];
    }
}
