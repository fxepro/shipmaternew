<?php

namespace App\Services\Checks;

use App\Models\CarrierVehicle;
use App\Models\OrgCheck;
use App\Models\Organization;
use App\Services\FmcsaService;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Checks against public registers (demo/compliance-checks.html):
 *  - FMCSA QCMobile: broker authority and the BMC-84/85 bond or trust on file
 *  - SAM.gov Entity API: the shipper's SAM registration (UEI) is active
 *  - NHTSA vPIC: a vehicle's VIN decodes to a real vehicle
 * Results feed the compliance items and re-run automatic approval.
 */
class RegistryChecks
{
    // ── FMCSA: broker authority and bond ───────────────────────────────────

    public static function fmcsaBroker(Organization $o): ?OrgCheck
    {
        if ($o->type !== 'broker' || !$o->fmcsa_broker_mc) return null;
        $check = OrgCheck::firstOrNew(['org_id' => $o->id, 'check' => 'fmcsa_broker']);
        $check->fill(['provider' => 'fmcsa', 'mode' => 'live', 'requested_at' => now(), 'error' => null]);
        try {
            $fmcsa = app(FmcsaService::class);
            $carrier = $fmcsa->lookupByMc($o->fmcsa_broker_mc);
            if (!$carrier) {
                $check->fill(['status' => 'completed', 'completed_at' => now(), 'results' => [
                    'authority' => ['state' => 'failed', 'message' => 'MC ' . $o->fmcsa_broker_mc . ' not found at FMCSA'],
                    'bond'      => ['state' => 'failed', 'message' => 'No FMCSA record'],
                ]])->save();
            } else {
                $auth = $carrier['dot_number'] ? $fmcsa->authority($carrier['dot_number']) : null;
                $broker = $auth['broker'] ?? null;
                $check->fill(['status' => 'completed', 'completed_at' => now(), 'external_id' => $carrier['dot_number'], 'results' => [
                    'authority' => $broker === 'A'
                        ? ['state' => 'passed', 'message' => 'Broker authority active · ' . ($carrier['legal_name'] ?? '')]
                        : ['state' => $broker === null ? 'review' : 'failed', 'message' => $broker === null ? 'FMCSA did not return the broker authority status' : 'Broker authority not active (' . $broker . ')'],
                    'bond' => $carrier['bond_on_file']
                        ? ['state' => 'passed', 'message' => 'Bond or trust on file at FMCSA']
                        : ['state' => 'failed', 'message' => 'No BMC-84/85 on file at FMCSA'],
                    'legal_name' => $carrier['legal_name'] ?? null,
                ]])->save();
            }
        } catch (\Throwable $e) {
            Log::warning('[FMCSA] broker check failed', ['org' => $o->id, 'error' => $e->getMessage()]);
            $check->fill(['status' => 'error', 'error' => $e->getMessage()])->save();
        }
        \App\Http\Controllers\Api\AdminCompanyController::autoApprove($o->fresh());
        return $check;
    }

    // ── SAM.gov: the entity registration is active ─────────────────────────

    public static function samGov(Organization $o): ?OrgCheck
    {
        $uei = strtoupper(trim((string) $o->sam_gov_number));
        if ($uei === '') return null;
        $check = OrgCheck::firstOrNew(['org_id' => $o->id, 'check' => 'sam_gov']);
        $check->fill(['provider' => 'sam_gov', 'mode' => 'live', 'requested_at' => now(), 'error' => null, 'external_id' => $uei]);
        $key = (string) config('services.sam_gov.key');
        if ($key === '') {
            $check->fill(['status' => 'error', 'error' => 'SAM.gov API key is not set on the server'])->save();
            return $check;
        }
        try {
            $r = Http::timeout(15)->acceptJson()->get('https://api.sam.gov/entity-information/v3/entities', ['api_key' => $key, 'ueiSAM' => $uei])->throw()->json();
            $reg = $r['entityData'][0]['entityRegistration'] ?? null;
            $active = ($reg['registrationStatus'] ?? null) === 'Active';
            $check->fill(['status' => 'completed', 'completed_at' => now(), 'results' => ['registration' => $reg
                ? ['state' => $active ? 'passed' : 'failed', 'message' => ($reg['registrationStatus'] ?? 'Unknown') . (isset($reg['registrationExpirationDate']) ? ' · expires ' . $reg['registrationExpirationDate'] : ''),
                   'expires' => $reg['registrationExpirationDate'] ?? null]
                : ['state' => 'failed', 'message' => "UEI {$uei} not found in SAM.gov"]]])->save();
        } catch (\Throwable $e) {
            Log::warning('[SAM.gov] check failed', ['org' => $o->id, 'error' => $e->getMessage()]);
            $check->fill(['status' => 'error', 'error' => $e->getMessage()])->save();
        }
        return $check;
    }

    // ── NHTSA vPIC: decode a VIN ───────────────────────────────────────────

    public static function vin(CarrierVehicle $v): void
    {
        $vin = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) $v->vin));
        if ($vin === '') {
            $v->forceFill(['vin_status' => null, 'vin_decoded' => null, 'vin_checked_at' => null])->saveQuietly();
            return;
        }
        try {
            $row = Http::timeout(15)->acceptJson()->get("https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{$vin}", ['format' => 'json'])->throw()->json('Results.0') ?? [];
            // ErrorCode "0" means the VIN decoded cleanly; anything else lists what was wrong with it
            $ok = strlen($vin) === 17 && (string) ($row['ErrorCode'] ?? '') === '0';
            $v->forceFill([
                'vin_status' => $ok ? 'valid' : 'invalid',
                'vin_decoded' => ['make' => $row['Make'] ?? null, 'model' => $row['Model'] ?? null, 'year' => $row['ModelYear'] ?? null,
                    'body' => $row['BodyClass'] ?? null, 'gvwr' => $row['GVWR'] ?? null, 'error' => $ok ? null : ($row['ErrorText'] ?? 'Not a valid VIN')],
                'vin_checked_at' => now(),
            ])->saveQuietly();
        } catch (\Throwable $e) {
            Log::warning('[vPIC] VIN decode failed', ['vehicle' => $v->id, 'error' => $e->getMessage()]);
            $v->forceFill(['vin_status' => 'error', 'vin_checked_at' => now()])->saveQuietly();
        }
    }

    /** Run every outside check a company's details call for (after it is saved) */
    public static function forOrg(Organization $o, bool $force = false): void
    {
        if (in_array($o->type, Kyb::TYPES, true)) Kyb::run($o, $force);
        if ($o->type === 'broker') self::fmcsaBroker($o);
        if ($o->sam_gov_number) self::samGov($o);
    }
}
