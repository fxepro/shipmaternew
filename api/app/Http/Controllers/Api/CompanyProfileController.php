<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Noa;
use App\Models\Organization;
use App\Models\Review;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Public company profiles at /c/{slug} (demo/public-profiles.html). Every value is the same field the internal page
 * shows. Never on it: tax IDs, bank and payout details, policy and bond numbers, street address, team members.
 * Signed-in companies see the whole profile; anyone else sees the name, location and badges and is asked to sign in.
 */
class CompanyProfileController extends Controller
{
    private const TYPE_LABELS = ['carrier' => 'Carrier', 'shipper' => 'Shipper', 'broker' => 'Broker', 'receiver' => 'Receiver', 'factor' => 'Factor'];
    /** Approval rows that are internal (money set-up), not something another company needs */
    private const HIDDEN_ROWS = ['payouts', 'subscription'];

    /** GET /api/v1/public/companies/{slug} */
    public function publicShow(string $slug): JsonResponse
    {
        $org = Organization::where('profile_slug', $slug)->whereIn('type', array_keys(self::TYPE_LABELS))->first();
        abort_if(!$org || in_array($org->verification_status, ['rejected', 'suspended'], true), 404, 'This profile isn\'t available.');

        $viewer = auth('sanctum')->user();
        $isOwn = $viewer && $viewer->current_org_id === $org->id;
        $signedIn = $viewer && ($viewer->current_org_id || $viewer->isPlatformAdmin());

        $base = [
            'slug'         => $org->profile_slug,
            'name'         => $org->name ?: $org->legal_name,
            'initials'     => collect(preg_split('/\s+/', trim((string) ($org->name ?: $org->legal_name))))->filter()->map(fn ($w) => mb_strtoupper(mb_substr($w, 0, 1)))->take(2)->implode(''),
            'logo_url'     => $org->logo_url,
            'type'         => $org->type,
            'type_label'   => self::TYPE_LABELS[$org->type],
            'location'     => $this->location($org),
            'member_since' => $org->created_at?->format('M Y'),
            'badges'       => $this->badges($org),
            'limited'      => !$signedIn,
            'is_own'       => (bool) $isOwn,
        ];
        if (!$signedIn) return response()->json(['data' => $base]);

        return response()->json(['data' => $base + [
            'about'         => $org->about,
            'company'       => $this->companyRows($org),
            'authority'     => in_array($org->type, ['carrier', 'broker'], true) ? $this->authorityRows($org) : [],
            'verification'  => $this->verificationRows($org),
            'services'      => $this->services($org),
            'performance'   => \App\Services\OrgMetrics::for($org),
            'reviews'       => $this->reviews($org),
            'contact'       => ['email' => $org->email, 'phone' => $org->phone_e164 ?: $org->phone, 'website' => $org->website],
            'edit_path'     => $isOwn ? '/' . $org->type . '/company' : null,
        ]]);
    }

    /** GET /api/v1/org/public-profile: the company's link and About */
    public function show(Request $request): JsonResponse
    {
        $org = $request->user()->currentOrg;
        abort_if(!$org, 404);
        return response()->json(['data' => ['slug' => $org->profileSlug(), 'about' => $org->about]]);
    }

    /** PUT /api/v1/org/public-profile {about} */
    public function update(Request $request): JsonResponse
    {
        $org = $request->user()->currentOrg;
        abort_if(!$org, 404);
        abort_unless($request->user()->canDo('company.profile'), 403, "Your role can't do this. Ask your company's owner if you need it.");
        $data = $request->validate(['about' => ['nullable', 'string', 'max:8000']]);
        $about = trim((string) ($data['about'] ?? ''));
        abort_if(str_word_count($about) > 1000, 422, 'About can be up to 1,000 words.');
        $org->update(['about' => $about ?: null]);
        return response()->json(['data' => ['slug' => $org->profileSlug(), 'about' => $org->about]]);
    }

    private function location(Organization $o): ?string
    {
        $useOps = $o->ops_same_as_biz === false && ($o->ops_city || $o->ops_state);
        return collect($useOps ? [$o->ops_city, $o->ops_state] : [$o->city, $o->state])->filter()->implode(', ') ?: null;
    }

    private function badges(Organization $o): array
    {
        $b = [];
        if ($o->verification_status === 'approved') $b[] = 'Verified on Shipmater';
        if (in_array($o->type, ['carrier', 'broker'], true)) {
            $a = $o->primaryAuthority($o->type === 'broker' ? 'broker' : 'carrier');
            if ($a && $a->status === 'active') $b[] = $o->type === 'broker' ? 'Broker authority active' : 'Authority active';
        }
        return $b;
    }

    /** [label, value] rows from Company identity; values the company hasn't entered are left out */
    private function companyRows(Organization $o): array
    {
        $rows = [
            ['Legal name', $o->legal_name ?: $o->name],
            ['DBA', $o->dba],
        ];
        if ($o->type === 'carrier') {
            $drivers = $o->orgMembers()->drivers()->where('status', 'active')->count();
            $trucks = DB::table('carrier_vehicles')->where('carrier_id', $o->id)->count();
            $rows[] = ['USDOT', $o->carrier_dot_number];
            $rows[] = ['MC', $o->carrier_mc_number];
            $rows[] = ['Operating country', $o->carrier_operating_country];
            $rows[] = ['Trucks / drivers', "{$trucks} / {$drivers}"];
        }
        if ($o->type === 'broker') $rows[] = ['Broker MC', $o->fmcsa_broker_mc];
        if (in_array($o->type, ['shipper', 'broker'], true)) $rows[] = ['Industry', $o->industry];
        $rows[] = ['Business type', $o->business_type];
        $rows[] = ['Year established', $o->year_established ? (string) $o->year_established : null];
        $rows[] = ['Employees', $o->employee_count ? (string) $o->employee_count : null];
        if ($o->type === 'receiver') {
            $n = DB::table('locations')->where('org_id', $o->id)->count();
            $rows[] = ['Delivery locations', $n ? (string) $n : null];
        }
        if ($o->type === 'factor') {
            $n = Noa::where('factor_id', $o->id)->where('status', 'active')->count();
            $rows[] = ['Carriers with an active notice', (string) $n];
        }
        $rows[] = ['Location', $this->location($o)];
        $rows[] = ['Website', $o->website];
        return array_values(array_filter($rows, fn ($r) => $r[1] !== null && $r[1] !== ''));
    }

    /** Authority and insurance from the primary authority: status, insurer, amount and expiry. No policy or bond numbers. */
    private function authorityRows(Organization $o): array
    {
        $a = $o->primaryAuthority($o->type === 'broker' ? 'broker' : 'carrier');
        if (!$a) return [];
        $date = fn ($d) => $d ? Carbon::parse($d)->format('M j, Y') : null;
        $money = fn ($v) => $v ? '$' . number_format((float) $v) : null;
        $rows = [['Authority', $a->status ? ucfirst($a->status) . ($a->authority_type ? ' · ' . ucfirst($a->authority_type) : '') : null, $date($a->verified_at)]];
        if ($o->type === 'carrier') {
            $rows[] = ['Auto liability', collect([$money($a->auto_coverage_amount), $a->auto_insurer_name, $a->auto_expiry_date ? 'expires ' . $date($a->auto_expiry_date) : null])->filter()->implode(' · ') ?: null, null];
            $rows[] = ['Cargo', collect([$money($a->cargo_coverage_amount), $a->cargo_insurer_name, $a->cargo_expiry_date ? 'expires ' . $date($a->cargo_expiry_date) : null])->filter()->implode(' · ') ?: null, null];
        }
        if ($o->type === 'broker') $rows[] = ['Surety bond', $a->bond_number ? 'On file' : null, null];
        $rec = DB::table('fmcsa_records')->where('org_id', $o->id)->orderByDesc('pulled_at')->first();
        if ($rec) {
            $d = json_decode($rec->data ?? '{}', true) ?: [];
            $rating = data_get($d, 'safety_rating') ?? data_get($d, 'carrier.safetyRating');
            if ($rating) $rows[] = ['Safety rating', (string) $rating, $date($rec->pulled_at)];
        }
        return array_values(array_filter($rows, fn ($r) => $r[1]));
    }

    /** The approval checklist (same rows and dates as Admin), as a result and a date only */
    private function verificationRows(Organization $o): array
    {
        $rows = app(AdminCompanyController::class)->approvalChecklist($o, $o->type === 'carrier');
        return collect($rows)->reject(fn ($r) => in_array($r['key'], self::HIDDEN_ROWS, true))
            ->map(fn ($r) => [
                'key'    => $r['key'],
                'label'  => $r['label'],
                'passed' => $r['state'] === 'passed',
                'date'   => $r['state'] === 'passed' && $r['checked_at'] ? Carbon::parse($r['checked_at'])->format('M j, Y') : null,
            ])->values()->all();
    }

    /** What the company does: service types, its certifications, directory categories, and for carriers the equipment in its fleet */
    private function services(Organization $o): array
    {
        $cats = \App\Support\OrgCategories::ALL;
        $equipment = $o->type === 'carrier'
            ? DB::table('carrier_vehicles as v')->leftJoin('capabilities as c', fn ($j) => $j->on('c.key', '=', 'v.equipment_type')->where('c.kind', 'equipment'))
                ->where('v.carrier_id', $o->id)->whereNotNull('v.equipment_type')->distinct()->pluck(DB::raw('coalesce(c.name, v.equipment_type)'))->values()->all()
            : [];
        return [
            'service_types'  => $o->serviceTypes()->orderBy('name')->pluck('name')->values()->all(),
            'certifications' => $o->certifications()->orderBy('name')->pluck('name')->values()->all(),
            'categories'     => collect($o->categories ?? [])->map(fn ($k) => $cats[$k][0] ?? null)->filter()->values()->all(),
            'equipment'      => $equipment,
        ];
    }

    /** GET /api/v1/org/performance: the company's own metrics (Performance tab) */
    public function performance(Request $request): JsonResponse
    {
        $org = $request->user()->currentOrg;
        abort_if(!$org, 404);
        return response()->json(['data' => \App\Services\OrgMetrics::for($org)]);
    }

    private function reviews(Organization $o): array
    {
        $shown = Review::with(['reviewerOrg', 'freightJob'])->where('reviewee_org_id', $o->id)->where('is_public', true)->shown()->latest()->limit(10)->get();
        return ['average' => $o->rating ? round((float) $o->rating, 1) : null, 'count' => (int) $o->total_ratings, 'items' => $shown->map->toCard()->values()];
    }
}
