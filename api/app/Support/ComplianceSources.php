<?php

namespace App\Support;

/**
 * What each compliance item is checked against, and whether that happens automatically or by Shipmater review.
 * The source of truth is demo/compliance-checks.html: change that first, then this list.
 */
class ComplianceSources
{
    /** key => [checked against, method: auto | review] */
    public const SOURCES = [
        // Everyone
        'owner_email'       => ['Code emailed to the owner', 'auto'],
        // Carrier
        'dot_number'        => ['FMCSA company census (QCMobile)', 'auto'],
        'mc_number'         => ['FMCSA operating authority (QCMobile)', 'auto'],
        'auto_insurance'    => ['FMCSA insurance filing (BMC-91/91X)', 'auto'],
        'cargo_insurance'   => ['The certificate of insurance', 'review'],
        'owner_identity'    => ['Stripe Identity', 'auto'],
        'owner_background'  => ['Background check provider (Checkr)', 'auto'],
        'drivers_approved'  => ["Each driver's checks: Checkr MVR, FMCSA Clearinghouse, Stripe Identity", 'auto'],
        'vehicles'          => ['NHTSA VIN decoder (vPIC)', 'auto'],
        'payouts'           => ['Stripe Connect', 'auto'],
        // Shipper, broker, factor: business verification (KYB)
        'ein'               => ['IRS TIN match (Middesk)', 'auto'],
        'kyb_registration'  => ['Secretary of State records (Middesk)', 'auto'],
        'address'           => ['USPS and Secretary of State address (Middesk)', 'auto'],
        'kyb_sanctions'     => ['OFAC sanctions list (Middesk)', 'auto'],
        'authorized_signer' => ['Officers in the Secretary of State filing (Middesk)', 'auto'],
        // Shipper
        'phone_verified'    => ['SMS code to the number', 'auto'],
        'w9'                => ['The form, matched to the EIN and legal name', 'review'],
        'coi'               => ['The certificate of insurance', 'review'],
        'hazmat_reg'        => ['PHMSA hazmat registration records', 'review'],
        'hazmat_training'   => ['The certificate (the employer certifies training)', 'review'],
        'emergency_phone'   => ['Entered by the shipper (49 CFR 172.604)', 'auto'],
        'ttb_atf_permit'    => ['TTB permittee list or ATF FFL eZ Check', 'review'],
        'hipaa_baa'         => ['The signed agreement', 'review'],
        'sam_gov'           => ['SAM.gov Entity API', 'auto'],
        'payment_method'    => ['Stripe', 'auto'],
        'subscription'      => ['Stripe Billing', 'auto'],
        // Broker
        'broker_mc'         => ['FMCSA broker authority (QCMobile)', 'auto'],
        'surety_bond'       => ['FMCSA bond or trust on file (QCMobile)', 'auto'],
        'contingent_cargo'  => ['The certificate of insurance', 'review'],
        // Factor
        'factoring_license' => ["The issuing state's licence lookup", 'review'],
        'noa_template'      => ["The factor's own form", 'review'],
        'bank'              => ['Stripe Connect', 'auto'],
    ];

    /** ['check' => ..., 'method' => auto|review] for a key */
    public static function for(string $key): array
    {
        [$check, $method] = self::SOURCES[$key] ?? [null, 'review'];
        return ['check' => $check, 'method' => $method];
    }
}
