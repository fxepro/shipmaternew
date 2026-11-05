<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ServiceType;
use App\Models\ShipperDocument;
use App\Models\ShipperProfile;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ShipperProfileController extends Controller
{
    // ── Default notification preferences ─────────────────────────────────────

    private function defaultNotifEmail(): array
    {
        return [
            'carrier_assigned' => true,
            'pickup_confirmed'  => true,
            'in_transit'        => true,
            'delivered'         => true,
            'disputed'          => true,
            'weekly_summary'    => false,
            'marketing'         => false,
        ];
    }

    private function defaultNotifSms(): array
    {
        return [
            'carrier_assigned' => false,
            'pickup_confirmed'  => true,
            'in_transit'        => false,
            'delivered'         => true,
            'disputed'          => true,
        ];
    }

    private function shape(Request $request): array
    {
        $user    = $request->user();
        $profile = $user->shipperProfile;
        $org     = $user->currentOrg;

        return [
            // User
            'name'          => $user->name,
            'email'         => $user->email,
            'phone'         => $profile?->phone          ?? '',
            'phone_country_code' => $profile?->phone_country_code ?? 'US',
            'whatsapp'      => $profile?->whatsapp       ?? '',
            'whatsapp_country_code' => $profile?->whatsapp_country_code ?? ($profile?->phone_country_code ?? 'US'),
            'member_since'  => $user->created_at->format('M Y'),

            // Personal address
            'street'        => $profile?->street         ?? '',
            'city'          => $profile?->city           ?? '',
            'state'         => $profile?->state          ?? '',
            'zip'           => $profile?->zip            ?? '',
            'country'       => $profile?->country        ?? 'United States',

            // Business identity
            'company'                => $profile?->company_name          ?? '',
            'dba'                    => $profile?->dba                   ?? '',
            'business_type'          => $profile?->business_type         ?? 'Limited Liability Company (LLC)',
            'ein'                    => $profile?->ein                   ?? '',
            'tax_id'                 => $profile?->ein                   ?? '',
            // Tax ID type and currency belong to the company
            'tax_id_type'            => $org?->tax_id_type ?: 'EIN',
            'currency'               => $org?->currency ?: 'USD',
            'state_of_incorporation' => $profile?->state_of_incorporation ?? '',
            'year_established'       => $profile?->year_established      ?? '',
            'employee_count'         => $profile?->employee_count        ?? '',
            'industry'               => $profile?->industry              ?? 'Freight & Logistics',
            'website'                => $profile?->website               ?? '',
            'business_phone'         => $profile?->business_phone        ?? '',
            'business_email'         => $profile?->business_email        ?? '',
            'sam_gov_number'         => $profile?->sam_gov_number        ?? '',

            // Registered address
            'biz_street'    => $profile?->biz_street     ?? '',
            'biz_city'      => $profile?->biz_city       ?? '',
            'biz_state'     => $profile?->biz_state      ?? '',
            'biz_zip'       => $profile?->biz_zip        ?? '',
            'biz_country'   => $profile?->biz_country    ?: 'US',

            // Operating address
            'ops_same_as_biz' => (bool) ($profile?->ops_same_as_biz ?? true),
            'ops_street'      => $profile?->ops_street   ?? '',
            'ops_city'        => $profile?->ops_city     ?? '',
            'ops_state'       => $profile?->ops_state    ?? '',
            'ops_zip'         => $profile?->ops_zip      ?? '',
            'ops_country'     => $profile?->ops_country  ?: 'US',

            // Verification (read-only — set by platform processes, not self-service clicks)
            'verification_status' => $profile?->verification_status ?? 'incomplete',
            'email_verified'      => !is_null($user->email_verified_at),
            'phone_verified'      => !is_null($profile?->phone_verified_at),
            'ein_verified'        => !is_null($profile?->ein_verified_at),

            // Shipping defaults
            'default_pickup_contact_name'  => $profile?->default_pickup_contact_name  ?? '',
            'default_pickup_contact_phone' => $profile?->default_pickup_contact_phone ?? '',
            'internal_ref_format'          => $profile?->internal_ref_format          ?? '',
            'preferred_categories'         => $profile?->preferred_categories         ?? [],
            'notif_recipients'             => $profile?->notif_recipients             ?? [],

            // Compliance
            'coi_url'          => $profile?->coi_url          ?? '',
            'coi_expiry'       => $profile?->coi_expiry,
            'hipaa_baa_url'    => $profile?->hipaa_baa_url    ?? '',
            'hipaa_baa_expiry' => $profile?->hipaa_baa_expiry,
            'hazmat_reg_url'   => $profile?->hazmat_reg_url   ?? '',
            'hazmat_reg_expiry'=> $profile?->hazmat_reg_expiry,
            // Links to open the uploaded files (the *_url columns hold the stored path)
            'coi_file'         => ShipperDocument::fileUrl($profile?->coi_url),
            'hipaa_baa_file'   => ShipperDocument::fileUrl($profile?->hipaa_baa_url),
            'hazmat_reg_file'  => ShipperDocument::fileUrl($profile?->hazmat_reg_url),

            // Notifications
            'notif_email'      => $profile?->notif_email ?? $this->defaultNotifEmail(),
            'notif_sms'        => $profile?->notif_sms   ?? $this->defaultNotifSms(),

            // Org / service types
            'org_id'           => $org?->id,
            'org_name'         => $org?->name,
            'service_type_keys' => $org?->serviceTypes->pluck('key')->toArray() ?? [],
        ];
    }

    private function calculateVerificationStatus(ShipperProfile $profile, ?User $user = null): string
    {
        $user = $user ?? $profile->user;
        if (!$profile->company_name || !$profile->ein) return 'incomplete';
        // Once Shipmater has verified the business, editing other fields must not undo it
        if ($profile->ein_verified_at)                  return 'verified';
        if (!$user?->email_verified_at)               return 'incomplete';
        return 'submitted';
    }

    // ── GET /api/v1/shipper/profile ───────────────────────────────────────────

    public function show(Request $request): JsonResponse
    {
        abort_unless($request->user()->isShipper(), 403);
        $request->user()->load('shipperProfile', 'currentOrg.serviceTypes');

        return response()->json(['data' => $this->shape($request)]);
    }

    // ── PUT /api/v1/shipper/profile ───────────────────────────────────────────

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isShipper(), 403);

        $validated = $request->validate([
            // User
            'name'          => ['sometimes', 'string', 'max:255'],
            'email'         => ['sometimes', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'phone'         => ['sometimes', 'nullable', 'string', 'max:40'],
            'phone_country_code' => ['sometimes', 'nullable', 'string', 'size:2'],
            'whatsapp'      => ['sometimes', 'nullable', 'string', 'max:40'],
            'whatsapp_country_code' => ['sometimes', 'nullable', 'string', 'size:2'],

            // Personal address
            'street'        => ['sometimes', 'nullable', 'string', 'max:200'],
            'city'          => ['sometimes', 'nullable', 'string', 'max:100'],
            'state'         => ['sometimes', 'nullable', 'string', 'max:50'],
            'zip'           => ['sometimes', 'nullable', 'string', 'max:20'],
            'country'       => ['sometimes', 'nullable', 'string', 'max:100'],

            // Business identity
            'company'                => ['sometimes', 'nullable', 'string', 'max:200'],
            'dba'                    => ['sometimes', 'nullable', 'string', 'max:200'],
            'business_type'          => ['sometimes', 'nullable', 'string', 'max:100'],
            'ein'                    => ['sometimes', 'nullable', 'string', 'max:30'],
            'tax_id'                 => ['sometimes', 'nullable', 'string', 'max:30'],
            'tax_id_type'            => ['sometimes', 'nullable', 'string', 'max:10'],
            'currency'               => ['sometimes', 'nullable', 'string', 'size:3'],
            'state_of_incorporation' => ['sometimes', 'nullable', 'string', 'max:2'],
            'year_established'       => ['sometimes', 'nullable', 'string', 'max:4'],
            'employee_count'         => ['sometimes', 'nullable', 'string', 'max:30'],
            'industry'               => ['sometimes', 'nullable', 'string', 'max:100'],
            'website'                => ['sometimes', 'nullable', 'string', 'max:255'],
            'business_phone'         => ['sometimes', 'nullable', 'string', 'max:40'],
            'business_email'         => ['sometimes', 'nullable', 'email', 'max:255'],
            'sam_gov_number'         => ['sometimes', 'nullable', 'string', 'max:50'],

            // Registered address
            'biz_street'    => ['sometimes', 'nullable', 'string', 'max:200'],
            'biz_city'      => ['sometimes', 'nullable', 'string', 'max:100'],
            'biz_state'     => ['sometimes', 'nullable', 'string', 'max:50'],
            'biz_zip'       => ['sometimes', 'nullable', 'string', 'max:20'],
            'biz_country'   => ['sometimes', 'nullable', 'string', 'size:2'],

            // Operating address
            'ops_same_as_biz' => ['sometimes', 'boolean'],
            'ops_street'      => ['sometimes', 'nullable', 'string', 'max:200'],
            'ops_city'        => ['sometimes', 'nullable', 'string', 'max:100'],
            'ops_state'       => ['sometimes', 'nullable', 'string', 'max:50'],
            'ops_zip'         => ['sometimes', 'nullable', 'string', 'max:20'],
            'ops_country'     => ['sometimes', 'nullable', 'string', 'size:2'],

            // Shipping defaults
            'default_pickup_contact_name'  => ['sometimes', 'nullable', 'string', 'max:255'],
            'default_pickup_contact_phone' => ['sometimes', 'nullable', 'string', 'max:40'],
            'internal_ref_format'          => ['sometimes', 'nullable', 'string', 'max:100'],
            'preferred_categories'         => ['sometimes', 'array'],
            'notif_recipients'             => ['sometimes', 'array'],

            // Compliance
            'coi_url'          => ['sometimes', 'nullable', 'string'],
            'coi_expiry'       => ['sometimes', 'nullable', 'date'],
            'hipaa_baa_url'    => ['sometimes', 'nullable', 'string'],
            'hipaa_baa_expiry' => ['sometimes', 'nullable', 'date'],
            'hazmat_reg_url'   => ['sometimes', 'nullable', 'string'],
            'hazmat_reg_expiry'=> ['sometimes', 'nullable', 'date'],

            // Notifications
            'notif_email'   => ['sometimes', 'array'],
            'notif_sms'     => ['sometimes', 'array'],

            // Service types (org level)
            'service_type_keys'   => ['sometimes', 'array'],
            'service_type_keys.*' => ['string'],
        ]);

        // Update users table fields
        $userFields = array_intersect_key($validated, array_flip(['name', 'email']));
        if ($userFields) {
            $user->update($userFields);
        }

        // Tax ID type and currency are kept on the company (owner or staff only)
        $orgFields = array_intersect_key($validated, array_flip(['tax_id_type', 'currency']));
        if ($orgFields && $user->currentOrg && $user->isOrgAdmin()) {
            $user->currentOrg->update(array_map(fn ($v) => $v === null ? null : strtoupper($v), $orgFields));
        }

        // Map frontend keys -> column names
        $profileData = array_diff_key($validated, array_flip(['name', 'email', 'tax_id_type', 'currency']));
        // The page sends the tax ID as both tax_id and ein; it's kept in ein
        if (array_key_exists('tax_id', $profileData)) {
            $profileData['ein'] = $profileData['ein'] ?? $profileData['tax_id'];
            unset($profileData['tax_id']);
        }
        // File paths for compliance documents are set by the upload, not by the form
        $profileData = array_diff_key($profileData, array_flip(['coi_url', 'hipaa_baa_url', 'hazmat_reg_url']));
        if (isset($profileData['company'])) {
            $profileData['company_name'] = $profileData['company'];
            unset($profileData['company']);
        }

        // Sync org service types if provided
        $serviceTypeKeys = $validated['service_type_keys'] ?? null;
        $profileData = array_diff_key($profileData, ['service_type_keys' => null]);

        if ($profileData) {
            // Keep E.164 in sync for SMS when phone / dial country change
            if (array_key_exists('phone', $profileData) || array_key_exists('phone_country_code', $profileData)) {
                $existing = ShipperProfile::where('user_id', $user->id)->first();
                $national = $profileData['phone'] ?? $existing?->phone ?? '';
                $cc = strtoupper($profileData['phone_country_code'] ?? $existing?->phone_country_code ?? 'US');
                $profileData['phone_country_code'] = $cc;
                try {
                    $profileData['phone_e164'] = app(\App\Services\SmsOtpService::class)
                        ->normalizeE164((string) $national, $cc);
                } catch (\Throwable) {
                    $profileData['phone_e164'] = null;
                }
            }

            ShipperProfile::updateOrCreate(
                ['user_id' => $user->id],
                array_merge($profileData, ['org_id' => $user->current_org_id])
            );
        }

        if ($serviceTypeKeys !== null && $user->currentOrg) {
            $ids = ServiceType::whereIn('key', $serviceTypeKeys)->pluck('id');
            $user->currentOrg->serviceTypes()->sync($ids);
        }

        // Recalculate verification status
        $profile = $user->fresh()->shipperProfile;
        if ($profile) {
            $status = $this->calculateVerificationStatus($profile, $user);
            $profile->update(['verification_status' => $status]);
        }

        $user->load('shipperProfile', 'currentOrg.serviceTypes');

        return response()->json(['data' => $this->shape($request)]);
    }
}