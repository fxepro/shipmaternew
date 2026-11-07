<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\JobStop;
use App\Models\Location;
use App\Services\OrgDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Your own company's locations. A location has no pickup or delivery type: any of them can ship and receive.
 * Other companies' locations are in the directory (DirectoryController).
 */
class LocationController extends Controller
{
    public function __construct(private OrgDirectory $dir) {}

    public function index(Request $request): JsonResponse
    {
        $org = $request->user()->viewingAs?->id ?? $request->user()->current_org_id;
        $query = Location::where('org_id', $org);

        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('name', 'ilike', "%$s%")
                  ->orWhere('city', 'ilike', "%$s%")
                  ->orWhere('address', 'ilike', "%$s%");
            });
        }

        if ($request->boolean('is_default')) {
            $query->where('is_default', true);
        }

        $locations = $query->withCount('contacts')->orderByDesc('usage_count')->orderBy('name')->get();

        return response()->json(['data' => $locations]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(OrgDirectory::required(OrgDirectory::LOCATION_RULES, ['name', 'address', 'city', 'zip']));
        abort_unless($request->user()->current_org_id, 422, 'Join or create a company first.');
        $location = $this->dir->addLocation($request->user()->currentOrg, $request->user(), $data);

        return response()->json(['data' => $location], 201);
    }

    public function update(Request $request, Location $location): JsonResponse
    {
        $this->authorise($request, $location);
        $location->update($request->validate(OrgDirectory::required(OrgDirectory::LOCATION_RULES, [])));

        return response()->json(['data' => $location->fresh()]);
    }

    public function destroy(Request $request, Location $location): JsonResponse
    {
        $this->authorise($request, $location);
        if (JobStop::where('location_id', $location->id)->exists()) {
            return response()->json(['message' => 'This location is on loads, so it can\'t be removed. Make it private instead.', 'code' => 'location_in_use'], 422);
        }
        $location->delete();
        return response()->json(['message' => 'deleted']);
    }

    private function authorise(Request $request, Location $location): void
    {
        abort_unless((int) $location->org_id === (int) $request->user()->current_org_id, 403);
    }
}
