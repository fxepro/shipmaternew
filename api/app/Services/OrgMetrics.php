<?php

namespace App\Services;

use App\Models\Organization;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Performance metrics (demo/public-profiles.html): calculated from what happened on loads (stop times, signatures,
 * payments, NOAs), never from reviews. Saved daily in org_metrics so the internal Performance tab and the public
 * profile show the same number, with the period and how many loads or stops it is based on.
 * A metric shows "Not enough loads yet" until it has MIN_SAMPLE records in the last 12 months.
 */
class OrgMetrics
{
    public const MIN_SAMPLE = 5;
    public const MONTHS = 12;

    /** type => key => [label, what it measures, unit (pct | minutes | hours | days), what it counts, higher is better] */
    public const DEFINITIONS = [
        'shipper' => [
            'paid_on_time'        => ['Paid on time', 'Share of loads paid by the invoice due date.', 'pct', 'loads', true],
            'dock_time'           => ['Average time at its docks', 'Average time a truck spends at its pickup stops, from arrival to departure.', 'minutes', 'pickups', false],
            'cancelled_after_booking' => ['Cancelled after booking', 'Share of loads cancelled after a carrier was assigned.', 'pct', 'loads', false],
            'disputed'            => ['Loads disputed', 'Share of loads that went to dispute.', 'pct', 'loads', false],
        ],
        'carrier' => [
            'on_time'             => ['On-time pickup and delivery', 'Share of stops where the carrier arrived by the end of the window.', 'pct', 'stops', true],
            'paperwork'           => ['Paperwork complete', 'Share of delivered loads with every delivery signed or a POD.', 'pct', 'loads', true],
            'disputed'            => ['Loads disputed', 'Share of loads that went to dispute.', 'pct', 'loads', false],
        ],
        'broker' => [
            'delivered_as_booked' => ['Loads delivered as booked', 'Share of booked loads that were delivered rather than cancelled.', 'pct', 'loads', true],
            'disputed'            => ['Loads disputed', 'Share of loads that went to dispute.', 'pct', 'loads', false],
        ],
        'receiver' => [
            'dock_time'           => ['Average time at its docks', 'Average time from a truck arriving to the delivery being completed.', 'minutes', 'deliveries', false],
            'unloaded_2h'         => ['Unloaded within 2 hours', 'Share of deliveries completed within 2 hours of arrival.', 'pct', 'deliveries', true],
            'signed_on_site'      => ['Delivery signed on site', 'Share of deliveries signed for at the dock, not later.', 'pct', 'deliveries', true],
        ],
        'factor' => [
            'noa_decision'        => ['Median time to approve a notice', 'From a carrier submitting an NOA to the factor deciding.', 'hours', 'NOAs', false],
            'funding'             => ['Median time to fund a load', 'From approving a factored load to funding it.', 'hours', 'loads', false],
            'declined'            => ['Loads declined', 'Share of submitted loads the factor declined.', 'pct', 'loads', false],
            'release'             => ['Median time to release a notice', 'From a release request to the release.', 'hours', 'releases', false],
        ],
    ];

    /** Saved metrics for a company, calculated now when missing or older than a day */
    public static function for(Organization $org): array
    {
        $defs = self::DEFINITIONS[$org->type] ?? [];
        if (!$defs) return [];
        $saved = DB::table('org_metrics')->where('org_id', $org->id)->get()->keyBy('key');
        $stale = $saved->count() < count($defs) || $saved->contains(fn ($m) => Carbon::parse($m->computed_at)->lt(now()->subDay()));
        if ($stale) { self::compute($org); $saved = DB::table('org_metrics')->where('org_id', $org->id)->get()->keyBy('key'); }

        return collect($defs)->map(function ($d, $key) use ($saved) {
            $m = $saved[$key] ?? null;
            $enough = $m && $m->sample >= self::MIN_SAMPLE && $m->value !== null;
            return [
                'key' => $key, 'label' => $d[0], 'description' => $d[1], 'unit' => $d[2],
                'value' => $enough ? (float) $m->value : null,
                'display' => $enough ? self::format((float) $m->value, $d[2]) : null,
                'sample' => (int) ($m->sample ?? 0), 'counts' => $d[3],
                'basis' => $m ? "{$m->sample} {$d[3]} · last " . self::MONTHS . ' months' : null,
                'period_from' => $m?->period_from, 'period_to' => $m?->period_to,
                'computed_at' => $m ? Carbon::parse($m->computed_at)->toISOString() : null,
            ];
        })->values()->all();
    }

    /** Calculate and save every metric for the company's type */
    public static function compute(Organization $org): void
    {
        $from = now()->subMonths(self::MONTHS)->startOfDay();
        $results = match ($org->type) {
            'shipper'  => self::shipper($org->id, $from),
            'carrier'  => self::carrier($org->id, $from),
            'broker'   => self::broker($org->id, $from),
            'receiver' => self::receiver($org->id, $from),
            'factor'   => self::factor($org->id, $from),
            default    => [],
        };
        foreach ($results as $key => [$value, $sample]) {
            DB::table('org_metrics')->updateOrInsert(['org_id' => $org->id, 'key' => $key], [
                'value' => $value, 'sample' => $sample,
                'period_from' => $from->toDateString(), 'period_to' => now()->toDateString(), 'computed_at' => now(),
            ]);
        }
    }

    // ── By type ─────────────────────────────────────────────────────────────

    private static function shipper(int $id, Carbon $from): array
    {
        $booked = DB::table('freight_jobs')->where('shipper_id', $id)->whereNotNull('carrier_id')->where('created_at', '>=', $from);
        return [
            'paid_on_time' => self::paidOnTime($id, $from),
            'dock_time'    => self::dockMinutes(DB::table('job_stops as s')->join('freight_jobs as j', 'j.id', '=', 's.freight_job_id')
                ->where('j.shipper_id', $id)->where('s.stop_type', 'pickup')->where('s.arrived_at', '>=', $from)),
            'cancelled_after_booking' => self::share((clone $booked)->count(), (clone $booked)->where('status', 'cancelled')->count()),
            'disputed'     => self::share((clone $booked)->count(), (clone $booked)->where('status', 'disputed')->count()),
        ];
    }

    private static function carrier(int $id, Carbon $from): array
    {
        $stops = DB::table('job_stops as s')->join('freight_jobs as j', 'j.id', '=', 's.freight_job_id')
            ->where('j.carrier_id', $id)->whereNotNull('s.arrived_at')->whereNotNull('s.scheduled_date')->whereNotNull('s.window_end')
            ->where('s.arrived_at', '>=', $from)->get(['s.arrived_at', 's.scheduled_date', 's.window_end']);
        $onTime = $stops->filter(fn ($s) => Carbon::parse($s->arrived_at)->lte(Carbon::parse(substr($s->scheduled_date, 0, 10) . ' ' . $s->window_end)))->count();

        $delivered = DB::table('freight_jobs')->where('carrier_id', $id)->where('status', 'completed')->where('created_at', '>=', $from)->pluck('id');
        $complete = $delivered->isEmpty() ? 0 : DB::table('job_stops')->whereIn('freight_job_id', $delivered)->where('stop_type', 'dropoff')
            ->groupBy('freight_job_id')->havingRaw('bool_and(signature_at is not null or pod_generated_at is not null)')->pluck('freight_job_id')->count();

        $booked = DB::table('freight_jobs')->where('carrier_id', $id)->where('created_at', '>=', $from);
        return [
            'on_time'   => self::share($stops->count(), $onTime),
            'paperwork' => self::share($delivered->count(), $complete),
            'disputed'  => self::share((clone $booked)->count(), (clone $booked)->where('status', 'disputed')->count()),
        ];
    }

    private static function broker(int $id, Carbon $from): array
    {
        $jobs = DB::table('freight_jobs')->where('broker_id', $id)->where('created_at', '>=', $from);
        $done = (clone $jobs)->where('status', 'completed')->count();
        $cancelled = (clone $jobs)->where('status', 'cancelled')->count();
        $booked = (clone $jobs)->whereNotNull('carrier_id');
        return [
            'delivered_as_booked' => self::share($done + $cancelled, $done),
            'disputed'            => self::share((clone $booked)->count(), (clone $booked)->where('status', 'disputed')->count()),
        ];
    }

    private static function receiver(int $id, Carbon $from): array
    {
        $stops = DB::table('job_stops as s')->join('locations as l', 'l.id', '=', 's.location_id')
            ->where('l.org_id', $id)->where('s.stop_type', 'dropoff')->whereNotNull('s.arrived_at')->whereNotNull('s.completed_at')
            ->where('s.arrived_at', '>=', $from)->get(['s.arrived_at', 's.completed_at', 's.signature_at']);
        $mins = $stops->map(fn ($s) => Carbon::parse($s->arrived_at)->diffInMinutes(Carbon::parse($s->completed_at)));
        return [
            'dock_time'      => [$mins->isEmpty() ? null : round($mins->avg(), 1), $mins->count()],
            'unloaded_2h'    => self::share($mins->count(), $mins->filter(fn ($m) => $m <= 120)->count()),
            'signed_on_site' => self::share($stops->count(), $stops->filter(fn ($s) => $s->signature_at && Carbon::parse($s->signature_at)->lte(Carbon::parse($s->completed_at)->addMinutes(30)))->count()),
        ];
    }

    private static function factor(int $id, Carbon $from): array
    {
        $hours = fn (Collection $rows, string $a, string $b) => $rows->filter(fn ($r) => $r->$a && $r->$b)
            ->map(fn ($r) => Carbon::parse($r->$a)->diffInMinutes(Carbon::parse($r->$b)) / 60);
        $noas = DB::table('noas')->where('factor_id', $id)->where('created_at', '>=', $from)->get(['created_at', 'decided_at', 'release_requested_at', 'released_at']);
        $loads = DB::table('factored_loads')->where('factor_id', $id)->where('created_at', '>=', $from)->get(['status', 'decided_at', 'funded_at']);
        $decision = $hours($noas, 'created_at', 'decided_at');
        $funding = $hours($loads, 'decided_at', 'funded_at');
        $release = $hours($noas, 'release_requested_at', 'released_at');
        $decided = $loads->whereNotNull('decided_at');
        return [
            'noa_decision' => [self::median($decision), $decision->count()],
            'funding'      => [self::median($funding), $funding->count()],
            'declined'     => self::share($decided->count(), $decided->where('status', 'declined')->count()),
            'release'      => [self::median($release), $release->count()],
        ];
    }

    // ── Shared ──────────────────────────────────────────────────────────────

    /** Loads paid by the invoice due date, of the loads whose due date has come */
    private static function paidOnTime(int $shipperId, Carbon $from): array
    {
        $rows = DB::table('load_payments as p')->join('freight_jobs as j', fn ($j) => $j->on('j.id', '=', 'p.load_id')->where('p.load_type', 'freight_job'))
            ->where('j.shipper_id', $shipperId)->whereNotNull('j.invoice_due_date')->where('j.invoice_due_date', '>=', $from)
            ->where(fn ($q) => $q->whereNotNull('p.paid_at')->orWhere('j.invoice_due_date', '<', now()->toDateString()))
            ->get(['p.paid_at', 'j.invoice_due_date']);
        $onTime = $rows->filter(fn ($r) => $r->paid_at && Carbon::parse($r->paid_at)->lte(Carbon::parse($r->invoice_due_date)->endOfDay()))->count();
        return self::share($rows->count(), $onTime);
    }

    private static function dockMinutes($query): array
    {
        $mins = $query->whereNotNull('s.arrived_at')->whereNotNull('s.completed_at')->get(['s.arrived_at', 's.completed_at'])
            ->map(fn ($s) => Carbon::parse($s->arrived_at)->diffInMinutes(Carbon::parse($s->completed_at)));
        return [$mins->isEmpty() ? null : round($mins->avg(), 1), $mins->count()];
    }

    /** [percent, sample] */
    private static function share(int $of, int $count): array
    {
        return [$of ? round($count / $of * 100, 1) : null, $of];
    }

    private static function median(Collection $v): ?float
    {
        if ($v->isEmpty()) return null;
        $s = $v->sort()->values(); $n = $s->count();
        return round($n % 2 ? $s[intdiv($n, 2)] : ($s[$n / 2 - 1] + $s[$n / 2]) / 2, 2);
    }

    public static function format(float $v, string $unit): string
    {
        return match ($unit) {
            'pct'     => round($v) . '%',
            'minutes' => $v >= 60 ? floor($v / 60) . ' h ' . round(fmod($v, 60)) . ' m' : round($v) . ' m',
            'hours'   => $v >= 48 ? round($v / 24, 1) . ' days' : round($v, 1) . ' h',
            default   => (string) $v,
        };
    }
}
