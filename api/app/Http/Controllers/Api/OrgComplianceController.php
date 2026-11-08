<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OrgComplianceItem;
use App\Models\Organization;
use App\Support\ComplianceRules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Compliance items a company uploads (W-9, licence, surety bond, COI...), see App\Support\ComplianceRules.
 * The company adds them from its own profile; a Shipmater admin can add them on its behalf and verifies them.
 */
class OrgComplianceController extends Controller
{
    // GET /api/v1/org/compliance
    public function index(Request $request): JsonResponse
    {
        $org = $this->myOrg($request);
        return response()->json(['data' => ComplianceRules::items($org)]);
    }

    // POST /api/v1/org/compliance/{key}   multipart: document, value?, expires?
    public function upload(Request $request, string $key): JsonResponse
    {
        $org = $this->myOrg($request);
        abort_unless($request->user()->canDo('company.profile'), 403, "Your role can't do this. Ask your company's owner if you need it.");
        return $this->store($request, $org, $key);
    }

    // POST /api/v1/admin/companies/{org}/compliance/{key}   (admin adds it for the company)
    public function adminUpload(Request $request, Organization $org, string $key): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);
        return $this->store($request, $org, $key);
    }

    // POST /api/v1/admin/companies/{org}/compliance/{key}/verify   { verified: bool }
    public function verify(Request $request, Organization $org, string $key): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);
        $data = $request->validate(['verified' => ['required', 'boolean']]);

        $row = OrgComplianceItem::where('org_id', $org->id)->where('key', $key)->whereNotNull('file_path')->first();
        abort_unless($row, 422, 'Nothing has been uploaded for this item yet.');
        $row->update($data['verified']
            ? ['verified_at' => now(), 'verified_by' => $request->user()->id]
            : ['verified_at' => null, 'verified_by' => null]);
        AdminCompanyController::autoApprove($org->fresh());

        return response()->json(['data' => ComplianceRules::items($org)]);
    }

    private function store(Request $request, Organization $org, string $key): JsonResponse
    {
        $item = collect(ComplianceRules::items($org))->firstWhere('key', $key);
        abort_unless($item && $item['upload'], 422, 'This item is not uploaded for this type of company.');

        $data = $request->validate([
            // Value-only items (authorized signer, emergency phone) may have no file
            'document' => [empty($item['upload']['value_only']) ? 'required' : 'nullable', 'file', 'max:10240', 'mimes:pdf,jpg,jpeg,png,webp'],
            'value'    => [empty($item['upload']['value_only']) ? 'nullable' : 'required_without:document', 'nullable', 'string', 'max:255'],
            'expires'  => [$item['upload']['expires'] ? 'nullable' : 'prohibited', 'date'],
        ]);

        $file = $request->file('document');
        $disk = (!empty(config('filesystems.disks.r2.key')) && !empty(config('filesystems.disks.r2.bucket'))) ? 'r2' : 'public';
        $path = $file?->storeAs("compliance/org-{$org->id}", time() . "_{$key}." . $file->getClientOriginalExtension(), $disk);

        // A new file needs to be verified again
        OrgComplianceItem::updateOrCreate(['org_id' => $org->id, 'key' => $key], [
            'value'       => $data['value'] ?? null,
            'file_path'   => $path,
            'file_name'   => $file?->getClientOriginalName(),
            'expires_at'  => $data['expires'] ?? null,
            'verified_at' => null,
            'verified_by' => null,
            'uploaded_by' => $request->user()->id,
        ]);

        return response()->json(['data' => ComplianceRules::items($org)], 201);
    }

    private function myOrg(Request $request): Organization
    {
        $org = $request->user()->currentOrg;
        abort_unless($org, 422, 'You are not part of a company.');
        return $org;
    }
}
