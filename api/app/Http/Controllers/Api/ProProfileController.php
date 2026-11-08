<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Capability;
use App\Models\ProProfile;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** A person's professional profile (CDL, endorsements, experience, open to work) */
class ProProfileController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $p = ProProfile::firstOrNew(['user_id' => $request->user()->id]);
        return response()->json(['data' => $p->toCard()]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'headline'               => 'nullable|string|max:160',
            'roles'                  => 'sometimes|array',
            'roles.*'                => [Rule::in(array_keys(ProProfile::ROLES))],
            'years_experience'       => 'nullable|integer|min:0|max:70',
            'equipment_experience'   => 'sometimes|array',
            'equipment_experience.*' => [Rule::in(Capability::keys('equipment'))],
            'haul_types'             => 'sometimes|array',
            'haul_types.*'           => [Rule::in(array_keys(ProProfile::HAUL_TYPES))],
            'team_ok'                => 'sometimes|boolean',
            'home_city'              => 'nullable|string|max:120',
            'home_state'             => 'nullable|string|max:10',
            'home_country'           => 'sometimes|string|size:2',
            'preferred_regions'      => 'sometimes|array|max:20',
            'preferred_regions.*'    => 'string|max:40',
            'open_to_work'           => 'sometimes|boolean',
            'available_from'         => 'nullable|date',
            'bio'                    => 'nullable|string|max:2000',
            'visibility'             => 'sometimes|in:private,platform',
        ]);
        foreach (['roles', 'equipment_experience', 'haul_types', 'preferred_regions'] as $k) {
            if (isset($data[$k])) $data[$k] = array_values(array_unique($data[$k]));
        }
        $p = ProProfile::updateOrCreate(['user_id' => $request->user()->id], $data);
        return response()->json(['data' => $p->toCard()]);
    }

    public function adminShow(User $user): JsonResponse
    {
        return response()->json(['data' => ProProfile::firstOrNew(['user_id' => $user->id])->toCard()]);
    }
}
