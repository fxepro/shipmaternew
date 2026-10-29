<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FreightJob;
use App\Models\OrgMember;
use App\Models\Shipment;
use App\Models\User;
use App\Services\PersonChecks;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Carriers assign one of their drivers to a load. Only drivers approved by Shipmater whose
 * required credentials (CDL, medical card, etc.) are still current can be assigned.
 */
class DriverAssignmentController extends Controller
{
    // GET /api/v1/carrier/drivers
    public function drivers(Request $request): JsonResponse
    {
        $org = $request->user()->currentOrg;
        abort_unless($org && $org->type === 'carrier', 404);

        $drivers = OrgMember::where('org_id', $org->id)->where('role', 'driver')->where('status', 'active')
            ->with('user')->get()->filter(fn ($m) => $m->user)
            ->map(fn ($m) => $this->driverSummary($m->user))
            ->values();

        return response()->json(['data' => $drivers]);
    }

    // GET /api/v1/shipments/{id}/driver   and   GET /api/v1/freight-jobs/{id}/driver
    public function show(Request $request, int $id): JsonResponse
    {
        $shipment = $this->load($request, $id);
        $this->authorizeCarrier($request, $shipment, false);

        $driver = $shipment->driver_id ? User::find($shipment->driver_id) : null;

        return response()->json(['data' => [
            'driver'      => $driver ? $this->driverSummary($driver) : null,
            'assigned_at' => $shipment->driver_assigned_at,
            'can_assign'  => $request->user()->isDispatcher(),
        ]]);
    }

    // PUT /api/v1/shipments/{id}/driver   and   PUT /api/v1/freight-jobs/{id}/driver   { driver_id: int|null }
    public function assign(Request $request, int $id): JsonResponse
    {
        $shipment = $this->load($request, $id);
        $this->authorizeCarrier($request, $shipment, true);

        $data = $request->validate(['driver_id' => ['nullable', 'integer']]);
        $user = $request->user();

        if ($data['driver_id'] ?? null) {
            $isDriver = OrgMember::where('org_id', $user->current_org_id)->where('user_id', $data['driver_id'])
                ->where('role', 'driver')->where('status', 'active')->exists();
            if (!$isDriver) {
                return response()->json(['error' => 'That person is not a driver on your team.', 'code' => 'not_a_driver'], 422);
            }

            $driver = User::findOrFail($data['driver_id']);
            PersonChecks::refresh($driver);
            if (!PersonChecks::isCleared($driver)) {
                $summary = $this->driverSummary($driver);
                return response()->json([
                    'error' => "{$driver->name} can't be assigned yet: " . ($summary['reason'] ?? 'not approved by Shipmater') . '.',
                    'code'  => 'driver_not_cleared',
                ], 422);
            }
        }

        $shipment->forceFill([
            'driver_id'          => $data['driver_id'] ?? null,
            'driver_assigned_at' => ($data['driver_id'] ?? null) ? now() : null,
            'driver_assigned_by' => ($data['driver_id'] ?? null) ? $user->id : null,
        ])->save();

        return response()->json(['message' => ($data['driver_id'] ?? null) ? 'Driver assigned.' : 'Driver removed.']);
    }

    /** A marketplace shipment or a contracted freight job, by route */
    private function load(Request $request, int $id): Model
    {
        return $request->is('api/v1/freight-jobs/*') ? FreightJob::findOrFail($id) : Shipment::findOrFail($id);
    }

    /** The load must belong to someone at the caller's carrier company */
    private function authorizeCarrier(Request $request, Model $shipment, bool $assigning): void
    {
        $user = $request->user();
        $org  = $user->currentOrg;
        abort_unless($org && $org->type === 'carrier' && $shipment->carrier_id, 403);

        $sameCompany = $shipment->carrier_id === $user->id
            || OrgMember::where('org_id', $org->id)->where('user_id', $shipment->carrier_id)->exists();
        abort_unless($sameCompany, 403);

        if ($assigning) {
            abort_unless($user->isDispatcher(), 403, 'Only owners, staff and dispatchers can assign drivers.');
        }
    }

    private function driverSummary(User $driver): array
    {
        $checklist = PersonChecks::checklist($driver);
        $status    = $driver->personVerification?->status ?? 'incomplete';
        $cleared   = $status === 'approved' && $checklist['ready'];
        $problems  = collect($checklist['items'])->where('required', true)->where('state', '!=', 'met')
            ->map(fn ($i) => "{$i['label']} " . ($i['state'] === 'expired' ? 'expired' : ($i['state'] === 'failed' ? 'failed' : 'missing')))
            ->implode(', ');

        return [
            'id'      => $driver->id,
            'name'    => $driver->name,
            'status'  => $status,
            'cleared' => $cleared,
            'reason'  => $cleared ? null : ($problems ?: ($status === 'approved' ? null : 'awaiting Shipmater approval')),
        ];
    }
}
