<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Services\FmcsaOpenData;
use App\Services\PersonChecks;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** A carrier's or broker's FMCSA public record, as saved in fmcsa_records (App\Services\FmcsaOpenData::forOrg) */
class FmcsaRecordController extends Controller
{
    /** GET /api/v1/company/fmcsa-record: the signed-in carrier or broker */
    public function show(Request $request, FmcsaOpenData $data): JsonResponse
    {
        $org = PersonChecks::companyOf($request->user(), ['carrier', 'broker']);
        abort_unless($org, 404, 'Only carriers and brokers have an FMCSA record.');
        return response()->json($data->forOrg($org, $request->boolean('fresh')));
    }

    /** GET /api/v1/admin/companies/{org}/fmcsa-record: any carrier or broker, for admins */
    public function adminShow(Request $request, Organization $org, FmcsaOpenData $data): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);
        abort_unless(in_array($org->type, ['carrier', 'broker'], true), 404, 'Only carriers and brokers have an FMCSA record.');
        return response()->json($data->forOrg($org, $request->boolean('fresh')));
    }
}
