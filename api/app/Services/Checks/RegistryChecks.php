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
 *  - NHTSA vPIC: a vehicle's VIN decodes to a real vehicle and matches what was entered; NHTSA recalls for that model
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

    /** A VIN is 17 letters and digits, never I, O or Q */
    public static function cleanVin(?string $vin): string
    {
        return strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) $vin));
    }

    /**
     * Decode a VIN with NHTSA vPIC (free, no key). Returns status (valid/invalid), the fields we keep and the raw response.
     * Throws when vPIC can't be reached.
     */
    public static function decodeVin(string $vin): array
    {
        $vin = self::cleanVin($vin);
        $row = Http::timeout(15)->acceptJson()->get("https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{$vin}", ['format' => 'json'])->throw()->json('Results.0') ?? [];
        $row = array_filter($row, fn ($x) => $x !== null && $x !== '' && $x !== 'Not Applicable');
        $g = fn ($k) => isset($row[$k]) ? trim((string) $row[$k]) : null;
        // ErrorCode "0" means the VIN decoded cleanly; anything else lists what was wrong with it
        $ok = strlen($vin) === 17 && (string) ($row['ErrorCode'] ?? '') === '0';
        [$gMin, $gMax] = self::gvwrRange($g('GVWR'));
        $join = fn (...$p) => trim(implode(' ', array_filter($p))) ?: null;
        return [
            'vin'    => $vin,
            'status' => $ok ? 'valid' : 'invalid',
            'fields' => [
                'make' => $g('Make'), 'model' => $g('Model'), 'year' => $g('ModelYear'), 'series' => $g('Series'), 'trim' => $g('Trim'),
                'vehicle_type' => $g('VehicleType'), 'body' => $g('BodyClass'), 'manufacturer' => $g('Manufacturer'),
                'gvwr' => $g('GVWR'), 'gvwr_min_lb' => $gMin, 'gvwr_max_lb' => $gMax,
                'engine' => $join($g('EngineManufacturer'), $g('EngineModel')), 'engine_hp' => $g('EngineHP'), 'displacement_l' => $g('DisplacementL'),
                'fuel' => $g('FuelTypePrimary'), 'axles' => $g('Axles'), 'axle_config' => $g('AxleConfiguration'), 'drive' => $g('DriveType'),
                'brakes' => $g('BrakeSystemType'), 'trailer_type' => $g('TrailerType'), 'trailer_body' => $g('TrailerBodyType'), 'trailer_length' => $g('TrailerLength'),
                'plant' => implode(', ', array_filter([$g('PlantCity'), $g('PlantState'), $g('PlantCountry')])) ?: null,
                'error' => $ok ? null : ($g('ErrorText') ?? 'Not a valid VIN'),
                'source' => 'NHTSA vPIC',
            ],
            'raw' => $row,
        ];
    }

    /** vPIC weight class text ("Class 8: 33,001 lb and above (…)") to a pound range [min, max] */
    public static function gvwrRange(?string $text): array
    {
        if (!$text) return [null, null];
        $lb = explode('(', $text)[0];
        preg_match_all('/\d[\d,]*/', preg_replace('/^Class \w+:/i', '', $lb), $m);
        $n = array_map(fn ($x) => (int) str_replace(',', '', $x), $m[0]);
        if (!$n) return [null, null];
        if (stripos($lb, 'and above') !== false) return [$n[0], null];
        if (stripos($lb, 'or less') !== false) return [0, $n[0]];
        return [$n[0], $n[1] ?? $n[0]];
    }

    /** Decode the vehicle's VIN, store it, compare it with what was entered and look up recalls */
    public static function vin(CarrierVehicle $v): void
    {
        $vin = self::cleanVin($v->vin);
        if ($vin === '') {
            $v->forceFill(['vin_status' => null, 'vin_decoded' => null, 'vin_checked_at' => null, 'vin_mismatches' => null, 'vin_recalls' => null, 'recalls_checked_at' => null])->saveQuietly();
            return;
        }
        try {
            $d = self::decodeVin($vin);
            $v->forceFill(['vin_status' => $d['status'], 'vin_decoded' => $d['fields'] + ['raw' => $d['raw']], 'vin_checked_at' => now()]);
            $v->forceFill(['vin_mismatches' => self::mismatches($v)])->saveQuietly();
        } catch (\Throwable $e) {
            Log::warning('[vPIC] VIN decode failed', ['vehicle' => $v->id, 'error' => $e->getMessage()]);
            $v->forceFill(['vin_status' => 'error', 'vin_checked_at' => now()])->saveQuietly();
            return;
        }
        if ($v->vin_status === 'valid') self::recalls($v);
    }

    /**
     * Where what the carrier entered differs from the decoded VIN: year, make, trailer vs power unit, GVWR outside the weight class.
     * Model is not compared (names vary too much between the VIN and how people write them).
     */
    public static function mismatches(CarrierVehicle $v): array
    {
        $d = $v->vin_decoded ?? [];
        if ($v->vin_status !== 'valid' || !$d) return [];
        $out = [];
        if (!empty($d['year']) && $v->year && (string) $v->year !== (string) $d['year']) {
            $out[] = ['field' => 'year', 'entered' => (string) $v->year, 'decoded' => (string) $d['year']];
        }
        $norm = fn ($s) => strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) $s));
        [$a, $b] = [$norm($v->make), $norm($d['make'] ?? '')];
        if ($a !== '' && $b !== '' && !str_contains($a, $b) && !str_contains($b, $a) && substr($a, 0, 4) !== substr($b, 0, 4)) {
            $out[] = ['field' => 'make', 'entered' => $v->make, 'decoded' => $d['make']];
        }
        $vinTrailer = strtoupper((string) ($d['vehicle_type'] ?? '')) === 'TRAILER';
        $enteredTrailer = $v->vehicle_class === 'trailer' || $v->type === 'enclosed_trailer';
        $enteredPower = in_array($v->vehicle_class, ['tractor', 'straight_truck', 'van', 'pickup'], true);
        if (!empty($d['vehicle_type']) && (($enteredTrailer && !$vinTrailer) || ($enteredPower && $vinTrailer))) {
            $out[] = ['field' => 'vehicle_class', 'entered' => $v->vehicle_class ?: $v->type, 'decoded' => $d['vehicle_type']];
        }
        $g = $v->gvwr !== null ? (float) $v->gvwr : null;
        if ($g && ($d['gvwr_min_lb'] ?? null) !== null && ($g < $d['gvwr_min_lb'] || ($d['gvwr_max_lb'] !== null && $g > $d['gvwr_max_lb']))) {
            $out[] = ['field' => 'gvwr', 'entered' => number_format($g) . ' lb', 'decoded' => $d['gvwr']];
        }
        return $out;
    }

    /** NHTSA recalls for the decoded year, make and model. These are recalls for the model, not proof this vehicle is unrepaired. */
    public static function recalls(CarrierVehicle $v): void
    {
        $d = $v->vin_decoded ?? [];
        if (empty($d['make']) || empty($d['model']) || empty($d['year'])) {
            $v->forceFill(['vin_recalls' => [], 'recalls_checked_at' => now()])->saveQuietly();
            return;
        }
        try {
            $rows = Http::timeout(15)->acceptJson()->get('https://api.nhtsa.gov/recalls/recallsByVehicle', ['make' => $d['make'], 'model' => $d['model'], 'modelYear' => $d['year']])
                ->throw()->json('results') ?? [];
            $v->forceFill(['recalls_checked_at' => now(), 'vin_recalls' => array_map(fn ($r) => [
                'campaign'    => $r['NHTSACampaignNumber'] ?? null,
                'date'        => $r['ReportReceivedDate'] ?? null,
                'component'   => $r['Component'] ?? null,
                'summary'     => $r['Summary'] ?? null,
                'consequence' => $r['Consequence'] ?? null,
                'remedy'      => $r['Remedy'] ?? null,
                'park_it'     => (bool) ($r['parkIt'] ?? false),
            ], $rows)])->saveQuietly();
        } catch (\Throwable $e) {
            Log::warning('[NHTSA] recall lookup failed', ['vehicle' => $v->id, 'error' => $e->getMessage()]);
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
