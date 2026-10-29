<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PersonCredential;
use App\Services\PersonChecks;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * A person's own verification: what their role needs, their identity record and their credentials.
 * Admins review and verify these in People (AdminPeopleController).
 */
class MyChecksController extends Controller
{
    /** Identity fields that need re-verification when changed */
    private const CORE_IDENTITY = ['legal_first_name', 'legal_last_name', 'date_of_birth', 'id_type', 'id_number', 'id_issuing_state', 'id_issuing_country', 'id_expiry_date'];

    // GET /api/v1/me/checks
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        PersonChecks::refresh($user);
        $m  = PersonChecks::membership($user);
        $pv = PersonChecks::verification($user);

        $detail = app(AdminPeopleController::class)->detail($user, $m, $pv);
        unset($detail['verification']['background_reference'], $detail['verification']['background_notes']);

        $rules = PersonChecks::rules($m['type'], $m['role']);
        $detail['credential_types'] = collect(array_merge($rules['required'], $rules['recorded'], ['other']))
            ->unique()->map(fn ($t) => ['value' => $t, 'label' => PersonChecks::CREDENTIAL_LABELS[$t]])->values();
        $detail['background_required'] = $rules['background'];
        $detail['identity_required']   = $rules['identity'];
        $detail['min_age']             = $rules['min_age'];

        return response()->json(['data' => $detail]);
    }

    // PUT /api/v1/me/identity
    public function updateIdentity(Request $request): JsonResponse
    {
        $data = $request->validate([
            'legal_first_name'   => ['nullable', 'string', 'max:100'],
            'legal_middle_name'  => ['nullable', 'string', 'max:100'],
            'legal_last_name'    => ['nullable', 'string', 'max:100'],
            'suffix'             => ['nullable', 'string', 'max:20'],
            'date_of_birth'      => ['nullable', 'date', 'before:today'],
            'street'             => ['nullable', 'string', 'max:255'],
            'unit'               => ['nullable', 'string', 'max:50'],
            'city'               => ['nullable', 'string', 'max:100'],
            'state'              => ['nullable', 'string', 'max:100'],
            'zip'                => ['nullable', 'string', 'max:20'],
            'country'            => ['nullable', 'string', 'size:2'],
            'phone'              => ['nullable', 'string', 'max:40'],
            'id_type'            => ['nullable', 'in:driver_license,passport,state_id,national_id'],
            'id_number'          => ['nullable', 'string', 'max:50'],
            'id_issuing_state'   => ['nullable', 'string', 'max:100'],
            'id_issuing_country' => ['nullable', 'string', 'size:2'],
            'id_issue_date'      => ['nullable', 'date'],
            'id_expiry_date'     => ['nullable', 'date'],
            'ssn_last4'          => ['nullable', 'digits:4'],
            'submit'             => ['sometimes', 'boolean'],
        ]);

        $user     = $request->user();
        $identity = PersonChecks::identity($user);

        // A blank ID number means "keep the one on file" (we never send it back to the browser)
        if (empty($data['id_number'])) unset($data['id_number']);

        $identity->fill(collect($data)->except('submit')->all());

        $coreChanged = $identity->isDirty(self::CORE_IDENTITY);
        if ($identity->status === 'verified' && $coreChanged) {
            $identity->fill(['status' => 'submitted', 'verified_at' => null, 'verified_by' => null, 'verification_method' => null]);
        }
        if (($data['submit'] ?? false) && in_array($identity->status, ['not_started', 'failed'], true)) {
            $identity->fill(['status' => 'submitted', 'submitted_at' => now(), 'failure_reason' => null]);
        }
        $identity->save();

        PersonChecks::refresh($user);

        return response()->json(['data' => PersonChecks::identitySummary($identity->fresh())]);
    }

    // POST /api/v1/me/identity/files   { kind: id_front|id_back|selfie, file }
    public function uploadIdentityFile(Request $request): JsonResponse
    {
        $data = $request->validate([
            'kind' => ['required', 'in:id_front,id_back,selfie'],
            'file' => ['required', 'file', 'mimes:jpg,jpeg,png,heic,webp,pdf', 'max:10240'],
        ]);

        $user     = $request->user();
        $identity = PersonChecks::identity($user);
        $identity->{"{$data['kind']}_path"} = PersonChecks::storeFile($request->file('file'), $user->id, $data['kind']);
        if ($identity->status === 'verified') {
            $identity->fill(['status' => 'submitted', 'verified_at' => null, 'verified_by' => null, 'verification_method' => null]);
        }
        $identity->save();

        PersonChecks::refresh($user);

        return response()->json(['data' => PersonChecks::identitySummary($identity->fresh())]);
    }

    // POST /api/v1/me/credentials   (multipart)
    public function storeCredential(Request $request): JsonResponse
    {
        $people = app(AdminPeopleController::class);
        $data   = $people->validateCredential($request);
        unset($data['result']);   // check results are recorded by admins or by the check itself

        $cred = new PersonCredential(['user_id' => $request->user()->id, 'source' => 'self']);
        $people->fillCredential($cred, $data, $request);
        $cred->save();

        PersonChecks::refresh($request->user());

        return response()->json(['data' => PersonChecks::credentialSummary($cred)], 201);
    }

    // POST /api/v1/me/credentials/{credential}   (multipart update)
    public function updateCredential(Request $request, PersonCredential $credential): JsonResponse
    {
        abort_unless($credential->user_id === $request->user()->id, 404);

        $people = app(AdminPeopleController::class);
        $data   = $people->validateCredential($request);
        unset($data['result']);

        $people->fillCredential($credential, $data, $request);
        // Any change goes back to an admin for verification
        if ($credential->isDirty()) {
            $credential->fill(['verified_at' => null, 'verified_by' => null]);
        }
        $credential->save();

        PersonChecks::refresh($request->user());

        return response()->json(['data' => PersonChecks::credentialSummary($credential)]);
    }

    // DELETE /api/v1/me/credentials/{credential}   (unverified only)
    public function destroyCredential(Request $request, PersonCredential $credential): JsonResponse
    {
        abort_unless($credential->user_id === $request->user()->id, 404);
        abort_if($credential->verified_at !== null, 422, 'Verified credentials can only be removed by Shipmater.');

        $credential->delete();
        PersonChecks::refresh($request->user());

        return response()->json(['message' => 'Removed.']);
    }
}
