<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Certification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CertificationController extends Controller
{
    // GET /api/v1/certifications — nested categories + children
    public function index(): JsonResponse
    {
        $categories = Certification::with('children')
            ->whereNull('parent_id')
            ->where('active', true)
            ->orderBy('sort_order')
            ->get();

        return response()->json([
            'data' => $categories->map(fn($cat) => [
                'id'       => $cat->id,
                'key'      => $cat->key,
                'name'     => $cat->name,
                'icon'     => $cat->icon,
                'category' => $cat->category,
                'children' => $cat->children->map(fn($c) => [
                    'id'          => $c->id,
                    'key'         => $c->key,
                    'name'        => $c->name,
                    'description' => $c->description,
                ]),
            ]),
        ]);
    }

    // PUT /api/v1/carrier/certifications
    public function sync(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isCarrier(), 403);

        $validated = $request->validate([
            'certification_keys'   => ['required', 'array'],
            'certification_keys.*' => ['string'],
        ]);

        // Certifications belong to the carrier company (owner or staff)
        $org = \App\Services\PersonChecks::companyOf($user, 'carrier');
        abort_unless($org, 422, 'You are not part of a carrier company.');
        abort_unless($user->canDo('company.profile'), 403, "Your role can't do this. Ask your company's owner if you need it.");
        $ids = Certification::whereIn('key', $validated['certification_keys'])->pluck('id');
        $org->certifications()->sync($ids);

        return response()->json([
            'data' => [
                'certification_keys' => $org->certifications()->pluck('key')->toArray(),
            ],
        ]);
    }
}
