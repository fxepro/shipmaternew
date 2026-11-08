<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OperatingAuthority;
use App\Models\Organization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Operating authorities: a company's own (carrier, broker) and admin review.
 * A company can hold more than one kind. Status changes (active / revoked) are admin only.
 */
class AuthorityController extends Controller
{
    private function rules(bool $create): array
    {
        $req = $create ? 'required' : 'sometimes';
        return [
            'kind'                  => [$req, Rule::in(OperatingAuthority::KINDS)],
            'country'               => 'sometimes|string|max:3',
            'dot_number'            => 'nullable|string|max:20',
            'mc_number'             => 'nullable|string|max:30',
            'authority_number'      => 'nullable|string|max:60',
            'authority_type'        => 'nullable|in:common,contract,intrastate,private,broker,forwarder',
            'hazmat_authorized'     => 'sometimes|boolean',
            'is_primary'            => 'sometimes|boolean',
            'auto_insurer_name'     => 'nullable|string|max:255',
            'auto_policy_number'    => 'nullable|string|max:255',
            'auto_coverage_amount'  => 'nullable|numeric|min:0',
            'auto_expiry_date'      => 'nullable|date',
            'cargo_insurer_name'    => 'nullable|string|max:255',
            'cargo_policy_number'   => 'nullable|string|max:255',
            'cargo_coverage_amount' => 'nullable|numeric|min:0',
            'cargo_expiry_date'     => 'nullable|date',
            'bond_number'           => 'nullable|string|max:255',
            'notes'                 => 'nullable|string|max:2000',
        ];
    }

    private function own(Request $request): Organization
    {
        $org = Organization::find($request->user()->current_org_id);
        abort_unless($org, 422, 'Join or create a company first.');
        return $org;
    }

    private function save(Organization $org, OperatingAuthority $a, array $data): OperatingAuthority
    {
        foreach (['dot_number', 'mc_number'] as $k) {
            if (array_key_exists($k, $data)) $data[$k] = Organization::digits($data[$k]);
        }
        // Identity changed: back to pending until it is checked again
        if ($a->exists && $a->status === 'active' && collect(['dot_number', 'mc_number', 'authority_number', 'kind'])
                ->contains(fn ($k) => array_key_exists($k, $data) && (string) $data[$k] !== (string) $a->{$k})) {
            $data['status'] = 'pending';
            $data['verified_at'] = null;
        }
        $a->fill($data + ['org_id' => $org->id]);
        $first = !$org->authorities()->where('kind', $a->kind)->where('id', '!=', $a->id ?? 0)->exists();
        if ($first) $a->is_primary = true;
        $a->save();
        if ($a->is_primary) {
            $org->authorities()->where('kind', $a->kind)->where('id', '!=', $a->id)->update(['is_primary' => false]);
        }
        return $a;
    }

    // ── A company's own ────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $org = $this->own($request);
        return response()->json(['data' => $org->authorities()->orderBy('kind')->orderByDesc('is_primary')->get()->map->toCard()]);
    }

    public function store(Request $request): JsonResponse
    {
        $org = $this->own($request);
        $a = $this->save($org, new OperatingAuthority(['status' => 'pending', 'source' => 'self']), $request->validate($this->rules(true)));
        return response()->json(['data' => $a->toCard()], 201);
    }

    public function update(Request $request, OperatingAuthority $authority): JsonResponse
    {
        $org = $this->own($request);
        abort_unless($authority->org_id === $org->id, 404);
        $a = $this->save($org, $authority, $request->validate($this->rules(false)));
        return response()->json(['data' => $a->toCard()]);
    }

    public function destroy(Request $request, OperatingAuthority $authority): JsonResponse
    {
        $org = $this->own($request);
        abort_unless($authority->org_id === $org->id, 404);
        abort_if($authority->vehicles()->exists(), 422, 'Vehicles run under this authority. Move them first.');
        $authority->delete();
        return response()->json(['message' => 'Removed']);
    }

    // ── Admin ──────────────────────────────────────────────────────────────

    public function adminStore(Request $request, Organization $org): JsonResponse
    {
        $data = $request->validate($this->rules(true) + ['status' => ['sometimes', Rule::in(OperatingAuthority::STATUSES)]]);
        $a = $this->save($org, new OperatingAuthority(['status' => 'pending', 'source' => 'admin']), $data);
        return response()->json(['data' => $a->toCard()], 201);
    }

    public function adminUpdate(Request $request, OperatingAuthority $authority): JsonResponse
    {
        $data = $request->validate($this->rules(false) + ['status' => ['sometimes', Rule::in(OperatingAuthority::STATUSES)]]);
        $status = $data['status'] ?? null;
        unset($data['status']);
        $a = $this->save($authority->org, $authority, $data);
        if ($status) {
            $a->update([
                'status' => $status, 'source' => $status === 'active' ? 'admin' : $a->source,
                'verified_at' => $status === 'active' ? now() : $a->verified_at,
                'verified_by' => $status === 'active' ? $request->user()->id : $a->verified_by,
            ]);
        }
        return response()->json(['data' => $a->fresh()->toCard()]);
    }
}
