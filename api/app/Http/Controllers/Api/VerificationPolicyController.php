<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Services\VerificationPolicy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Admin Console, Compliance: which checks each company type must pass (required / optional / deferred / off),
 * approval mode per type, open-season promotions, and the log of every change.
 */
class VerificationPolicyController extends Controller
{
    // GET /api/v1/admin/verification-policy?type=shipper
    public function show(Request $request): JsonResponse
    {
        $this->admin($request);
        $type = $request->validate(['type' => ['required', 'in:' . implode(',', Organization::TYPES)]])['type'];
        VerificationPolicy::flush();

        $checks = collect(VerificationPolicy::catalog($type))->map(function ($c) use ($type) {
            [$setting, $days] = VerificationPolicy::base($type, $c['key'], $c['default']);
            return $c + ['setting' => $setting, 'defer_days' => $days, 'changed' => $setting !== $c['default']];
        })->values();

        $active = VerificationPolicy::activePromotion($type);
        $users  = fn ($ids) => DB::table('users')->whereIn('id', $ids)->pluck('name', 'id');

        $promos = collect(VerificationPolicy::promotions())->sortByDesc('starts_at')->values();
        $promoUsers = $users($promos->pluck('created_by')->filter());
        $log = DB::table('verification_policy_changes')->where(fn ($w) => $w->where('type', $type)->orWhereNull('type'))
            ->orderByDesc('id')->limit(50)->get();
        $logUsers = $users($log->pluck('user_id')->filter());

        return response()->json(['data' => [
            'type'          => $type,
            'approval_mode' => VerificationPolicy::approvalMode($type),
            'checks'        => $checks,
            'active_promotion' => $active ? ['id' => $active->id, 'name' => $active->name, 'ends_at' => $active->ends_at->toISOString(), 'settings' => $active->settings[$type] ?? []] : null,
            // Companies of this type that joined during an open season
            'relaxed_companies' => Organization::where('type', $type)->whereNotNull('joined_promotion_id')->count(),
            'promotions' => $promos->map(fn ($p) => [
                'id' => $p->id, 'name' => $p->name, 'types' => $p->types, 'settings' => $p->settings,
                'starts_at' => $p->starts_at->toISOString(), 'ends_at' => $p->ends_at->toISOString(),
                'catch_up_days' => $p->catch_up_days, 'created_by' => $promoUsers[$p->created_by] ?? null,
                'status' => now()->lt($p->starts_at) ? 'scheduled' : (now()->gt($p->ends_at) ? 'ended' : 'running'),
                'joined' => Organization::where('joined_promotion_id', $p->id)->count(),
            ]),
            'log' => $log->map(fn ($l) => [
                'id' => $l->id, 'type' => $l->type, 'subject' => $l->subject, 'from' => $l->from, 'to' => $l->to,
                'by' => $logUsers[$l->user_id] ?? null, 'at' => $l->created_at,
            ]),
        ]]);
    }

    // PUT /api/v1/admin/verification-policy/{type}/checks/{key}   { setting, defer_days? }
    public function updateCheck(Request $request, string $type, string $key): JsonResponse
    {
        $this->admin($request);
        $check = collect(VerificationPolicy::catalog($this->validType($type)))->firstWhere('key', $key);
        abort_unless($check, 404, 'No such check for this type.');
        $data = $request->validate([
            'setting'    => ['required', 'in:' . implode(',', VerificationPolicy::SETTINGS)],
            'defer_days' => ['nullable', 'integer', 'min:1', 'max:365'],
        ]);

        [$from, $fromDays] = VerificationPolicy::base($type, $key, $check['default']);
        $days = $data['setting'] === 'deferred' ? ($data['defer_days'] ?? $fromDays) : null;
        DB::table('verification_policies')->updateOrInsert(['type' => $type, 'check_key' => $key], [
            'setting' => $data['setting'], 'defer_days' => $days, 'updated_by' => $request->user()->id,
            'updated_at' => now(), 'created_at' => now(),
        ]);
        $this->log($request, $type, $key, $from . ($from === 'deferred' ? " {$fromDays}d" : ''), $data['setting'] . ($days ? " {$days}d" : ''));
        VerificationPolicy::flush();

        return $this->show($request->merge(['type' => $type]));
    }

    // PUT /api/v1/admin/verification-policy/{type}/approval-mode   { mode: manual|auto }
    public function updateApprovalMode(Request $request, string $type): JsonResponse
    {
        $this->admin($request);
        $this->validType($type);
        $mode = $request->validate(['mode' => ['required', 'in:manual,auto']])['mode'];
        $from = VerificationPolicy::approvalMode($type);
        DB::table('verification_type_settings')->updateOrInsert(['type' => $type], [
            'approval_mode' => $mode, 'updated_by' => $request->user()->id, 'updated_at' => now(), 'created_at' => now(),
        ]);
        $this->log($request, $type, 'approval_mode', $from, $mode);

        // Switching to automatic approves the companies that already pass every required check
        if ($mode === 'auto') {
            Organization::where('type', $type)->whereNotIn('verification_status', ['approved', 'rejected'])->whereNotNull('owner_id')
                ->get()->each(fn ($o) => AdminCompanyController::autoApprove($o));
        }
        return $this->show($request->merge(['type' => $type]));
    }

    // POST /api/v1/admin/compliance-promotions   PUT /api/v1/admin/compliance-promotions/{id}
    public function savePromotion(Request $request, ?int $id = null): JsonResponse
    {
        $this->admin($request);
        $data = $request->validate([
            'name'          => ['required', 'string', 'max:120'],
            'starts_at'     => ['required', 'date'],
            'ends_at'       => ['required', 'date', 'after:starts_at'],
            'types'         => ['required', 'array', 'min:1'],
            'types.*'       => ['in:' . implode(',', Organization::TYPES)],
            'settings'      => ['present', 'array'],
            'settings.*'    => ['array'],
            'settings.*.*'  => ['in:deferred,off'],
            'catch_up_days' => ['required', 'integer', 'min:1', 'max:365'],
            'type'          => ['nullable'],
        ]);
        // Only checks that exist for each type
        $settings = [];
        foreach ($data['types'] as $t) {
            $keys = collect(VerificationPolicy::catalog($t))->pluck('key');
            $settings[$t] = collect($data['settings'][$t] ?? [])->only($keys)->all();
        }
        $row = [
            'name' => $data['name'], 'starts_at' => $data['starts_at'], 'ends_at' => $data['ends_at'],
            'types' => json_encode(array_values($data['types'])), 'settings' => json_encode($settings),
            'catch_up_days' => $data['catch_up_days'], 'updated_at' => now(),
        ];
        if ($id) {
            abort_unless(DB::table('compliance_promotions')->where('id', $id)->update($row) || DB::table('compliance_promotions')->where('id', $id)->exists(), 404);
            $this->log($request, null, "promotion:{$id}", null, "edited: {$data['name']}");
        } else {
            $id = DB::table('compliance_promotions')->insertGetId($row + ['created_by' => $request->user()->id, 'created_at' => now()]);
            $this->log($request, null, "promotion:{$id}", null, "created: {$data['name']}");
        }
        VerificationPolicy::flush();
        return $this->show($request->merge(['type' => $request->input('type', $data['types'][0])]));
    }

    // POST /api/v1/admin/compliance-promotions/{id}/end   (ends it now; joiners get their catch-up window from now)
    public function endPromotion(Request $request, int $id): JsonResponse
    {
        $this->admin($request);
        $p = DB::table('compliance_promotions')->where('id', $id)->first();
        abort_unless($p, 404);
        DB::table('compliance_promotions')->where('id', $id)->update(['ends_at' => now(), 'updated_at' => now()]);
        $this->log($request, null, "promotion:{$id}", 'running', "ended: {$p->name}");
        VerificationPolicy::flush();
        return $this->show($request->merge(['type' => $request->input('type', json_decode($p->types, true)[0] ?? 'shipper')]));
    }

    private function log(Request $request, ?string $type, string $subject, ?string $from, ?string $to): void
    {
        DB::table('verification_policy_changes')->insert([
            'user_id' => $request->user()->id, 'type' => $type, 'subject' => $subject, 'from' => $from, 'to' => $to, 'created_at' => now(),
        ]);
    }

    private function admin(Request $request): void
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);
    }

    private function validType(string $type): string
    {
        abort_unless(in_array($type, Organization::TYPES, true), 404);
        return $type;
    }
}
