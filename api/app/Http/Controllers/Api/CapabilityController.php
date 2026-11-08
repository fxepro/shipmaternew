<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Capability;
use App\Models\Organization;
use App\Models\ProProfile;
use App\Support\OrgCategories;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Catalogs (equipment, features, endorsements, company categories, pro roles) and company categories */
class CapabilityController extends Controller
{
    public function catalog(): JsonResponse
    {
        $caps = Capability::where('active', true)->orderBy('kind')->orderBy('sort_order')->get(['key', 'name', 'kind', 'service_type_key']);
        return response()->json(['data' => [
            'equipment'    => $caps->where('kind', 'equipment')->values(),
            'features'     => $caps->where('kind', 'feature')->values(),
            'endorsements' => $caps->where('kind', 'endorsement')->values(),
            'categories'   => OrgCategories::catalog(),
            'pro_roles'    => collect(ProProfile::ROLES)->map(fn ($n, $k) => ['key' => $k, 'name' => $n])->values(),
            'haul_types'   => collect(ProProfile::HAUL_TYPES)->map(fn ($n, $k) => ['key' => $k, 'name' => $n])->values(),
        ]]);
    }

    private function saveCategories(Request $request, Organization $org): JsonResponse
    {
        $data = $request->validate([
            'categories'   => 'present|array|max:10',
            'categories.*' => ['string', Rule::in(OrgCategories::keys())],
        ]);
        $org->update(['categories' => array_values(array_unique($data['categories']))]);
        return response()->json(['data' => ['categories' => $org->categories]]);
    }

    public function updateOwnCategories(Request $request): JsonResponse
    {
        $org = Organization::find($request->user()->current_org_id);
        abort_unless($org, 422, 'Join or create a company first.');
        return $this->saveCategories($request, $org);
    }

    public function adminUpdateCategories(Request $request, Organization $org): JsonResponse
    {
        return $this->saveCategories($request, $org);
    }
}
