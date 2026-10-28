<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ServiceType;
use App\Services\ServiceTypeRules;
use Illuminate\Http\JsonResponse;

class ServiceTypeController extends Controller
{
    // GET /api/v1/service-types
    // Returns categories with their children nested
    public function index(): JsonResponse
    {
        $categories = ServiceType::with('children')
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
                'children' => $cat->children->map(fn($child) => [
                    'id'              => $child->id,
                    'key'             => $child->key,
                    'name'            => $child->name,
                    'requires_dot'    => $child->requires_dot,
                    'requires_mc'     => $child->requires_mc,
                    'requires_cdl'    => $child->requires_cdl,
                    'requires_hazmat' => $child->requires_hazmat,
                ]),
            ]),
        ]);
    }

    // GET /api/v1/service-types/rules?types[]=general_freight&types[]=hazmat
    public function rules(): JsonResponse
    {
        $keys = request()->query('types', []);
        if (is_string($keys)) $keys = explode(',', $keys);

        return response()->json([
            'data' => [
                'required_fields'    => ServiceTypeRules::requiredFields($keys),
                'recommended_fields' => ServiceTypeRules::recommendedFields($keys),
                'relevant_tabs'      => ServiceTypeRules::relevantTabs($keys),
                'requires_dot'       => ServiceTypeRules::requiresDot($keys),
            ],
        ]);
    }
}
