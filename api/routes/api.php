<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CarrierController;
use App\Http\Controllers\Api\AdminPeopleController;
use App\Http\Controllers\Api\CarrierVerificationController;
use App\Http\Controllers\Api\ClearinghouseController;
use App\Http\Controllers\Api\StripeConnectController;
use App\Http\Controllers\Api\ContractController;
use App\Http\Controllers\Api\FreightJobController;
use App\Http\Controllers\Api\FreightJobOfferController;
use App\Http\Controllers\Api\LocationController;
use App\Http\Controllers\Api\DirectoryController;
use App\Http\Controllers\Api\PaymentMethodController;
use App\Http\Controllers\Api\PreferredCarrierController;
use App\Http\Controllers\Api\ShipmentController;
use App\Http\Controllers\Api\ShipperProfileController;
use App\Http\Controllers\Api\BlogController;
use App\Http\Controllers\Api\CertificationController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\EvidenceController;
use App\Http\Controllers\Api\TenantController;
use App\Http\Controllers\Api\AdminCompanyController;
use App\Http\Controllers\Api\AdminOrgController;
use App\Http\Controllers\Api\OrgController;
use App\Http\Controllers\Api\MyChecksController;
use App\Http\Controllers\Api\DriverAssignmentController;
use App\Http\Controllers\Api\PlatformLeadController;
use App\Http\Controllers\Api\ReviewController;
use App\Http\Controllers\Api\ServiceTypeController;
use App\Http\Controllers\Api\ShipperVerificationController;
use App\Http\Controllers\Api\TrackController;
use App\Http\Controllers\Api\TransactionController;
use Illuminate\Support\Facades\Route;

// ── Public: tracking by token ──────────────────────────────────────────
Route::get('/track/{token}',  [TrackController::class, 'show']);
Route::post('/track/{token}', [TrackController::class, 'confirm']);

// ── Stripe webhook (public — Stripe signs it) ──────────────────────────
Route::post('/stripe/webhook', [StripeConnectController::class, 'webhook']);

// ── Shipmater's fees (public: pricing page, job wizard) ───────────────
Route::get('/fees', [\App\Http\Controllers\Api\FeesController::class, 'show']);

// ── Background check provider webhooks (public — each provider signs its own) ──
Route::post('/background/webhook/{provider}', [\App\Http\Controllers\Api\BackgroundCheckController::class, 'webhook']);
// Business verification results (Middesk); signed by the provider
Route::post('/kyb/webhook/{provider}', [\App\Http\Controllers\Api\ComplianceChecksController::class, 'webhook']);
Route::post('/checkr/webhook', [\App\Http\Controllers\Api\BackgroundCheckController::class, 'webhook']);   // older address, still set in Checkr
// The test provider's form: a signed link, refused in production
Route::get('/background/fake/{check}', [\App\Http\Controllers\Api\BackgroundCheckController::class, 'fake'])->name('background.fake')->middleware('signed');

// ── Clearinghouse webhook (public — FMCSA signs it) ───────────────────
Route::post('/clearinghouse/webhook', [ClearinghouseController::class, 'webhook']);

// ── Broadcasting auth ─────────────────────────────────────────────────
Route::post('/broadcasting/auth', function (\Illuminate\Http\Request $request) {
    return \Illuminate\Support\Facades\Broadcast::auth($request);
})->middleware(['auth:sanctum', 'account.status']);

// ── Blog (public) ─────────────────────────────────────────────────────
Route::get('/blog',        [BlogController::class, 'index']);
Route::get('/blog/{slug}', [BlogController::class, 'show']);

// ── Service types (public) ─────────────────────────────────────────────
Route::get('/service-types',       [ServiceTypeController::class, 'index']);
Route::get('/service-types/rules', [ServiceTypeController::class, 'rules']);

// ── Certifications (public list) ───────────────────────────────────────
Route::get('/certifications', [CertificationController::class, 'index']);

// ── Platform / white-label leads (public) ──────────────────────────────
Route::post('/platform-leads', [PlatformLeadController::class, 'store']);

// ── Tenant resolve (public — used by Next.js middleware) ───────────────────
Route::get('/tenant/resolve', [TenantController::class, 'resolve']);

// ── Org ratings (public — shown on carrier/shipper public profiles) ─────────
Route::get('/orgs/{org}/ratings', [ReviewController::class, 'profileRatings']);

// ── Ratings: org profile (public) ──────────────────────────────────────────
Route::get('/orgs/{org}/ratings', [ReviewController::class, 'profileRatings']);

// ── Auth (public) ──────────────────────────────────────────────────────────
Route::post('/auth/register', [AuthController::class, 'register']);
Route::get('/invitations/{token}', [OrgController::class, 'showInvitation'])->middleware('throttle:30,1');
Route::post('/auth/login',    [AuthController::class, 'login']);
Route::post('/auth/email/verify', [AuthController::class, 'verifyEmail'])
    ->middleware('throttle:10,1');
// Sign-up: find a listed company to claim (names and cities only)
Route::get('/directory/claimable', [DirectoryController::class, 'claimable'])->middleware('throttle:20,1');

// ── Authenticated ──────────────────────────────────────────────────────
// view.as: Admin Console, Carrier View and Shipper View read a company's pages as that company (read-only)
Route::middleware(['auth:sanctum', 'account.status', 'email.verified', 'view.as'])->group(function () {
    // Sign-up step: send the verification email again (allowed before the email is verified)
    Route::post('/auth/email/resend', [AuthController::class, 'resendVerification'])->middleware('throttle:3,1');


    // Current user
    Route::get('/user',          [AuthController::class, 'user']);
    Route::post('/auth/logout',  [AuthController::class, 'logout']);

    // Shipments: summaries of loads (freight jobs). Loads are created in the Create Job wizard (/shipper/freight-jobs)
    Route::get('/shipments',                         [ShipmentController::class, 'index'])->middleware('perm:carrier:loads.view=view,shipper:loads.view=view');
    Route::get('/shipments/{job}',                   [ShipmentController::class, 'show'])->middleware('perm:carrier:loads.view=view,shipper:loads.view=view');
    // ── Carrier operational routes — requires approved status ─────────────
    Route::middleware('carrier.approved')->group(function () {
        Route::get('/carrier/earnings',   [CarrierController::class, 'earnings'])->middleware('perm:carrier:money.payments=view');
        Route::post('/carrier/payout',    [CarrierController::class, 'requestPayout'])->middleware('perm:carrier:money.payments');
        Route::post('/jobs/{job}/ping',              [ShipmentController::class, 'ping'])->middleware('perm:carrier:trips.run');

        // Driver assignment: only approved drivers with current credentials
        Route::get('/carrier/drivers',               [DriverAssignmentController::class, 'drivers'])->middleware('perm:carrier:loads.assign');
        Route::get('/freight-jobs/{id}/driver',      [DriverAssignmentController::class, 'show'])->middleware('perm:carrier:loads.view=view');
        Route::put('/freight-jobs/{id}/driver',      [DriverAssignmentController::class, 'assign'])->middleware('perm:carrier:loads.assign');
    });

    // Carrier: profile, documents, vehicles (always accessible)
    Route::get('/carrier/kyc-status',          [CarrierController::class, 'kycStatus']);
    Route::get('/carrier/profile',             [CarrierController::class, 'show']);
    Route::put('/carrier/profile',             [CarrierController::class, 'update']);

    // Payout account setup (carriers and factors): details collected here, sent to Stripe once
    Route::get('/payouts/setup',     [\App\Http\Controllers\Api\PayoutSetupController::class, 'show'])->middleware('perm:carrier:company.payouts=view,factor:company.payouts=view');
    Route::put('/payouts/business',  [\App\Http\Controllers\Api\PayoutSetupController::class, 'business'])->middleware('perm:carrier:company.payouts,factor:company.payouts');
    Route::put('/payouts/bank',      [\App\Http\Controllers\Api\PayoutSetupController::class, 'bank'])->middleware('perm:carrier:company.payouts,factor:company.payouts');
    Route::post('/payouts/submit',   [\App\Http\Controllers\Api\PayoutSetupController::class, 'submit'])->middleware('perm:carrier:company.payouts,factor:company.payouts');
    Route::post('/payouts/refresh',  [\App\Http\Controllers\Api\PayoutSetupController::class, 'refresh'])->middleware('perm:carrier:company.payouts=view,factor:company.payouts=view');

    // Stripe Connect
    Route::post('/stripe/connect/onboard',     [StripeConnectController::class, 'onboard'])->middleware('perm:carrier:company.payouts,factor:company.payouts');
    Route::get('/stripe/connect/status',       [StripeConnectController::class, 'status'])->middleware('perm:carrier:company.payouts=view,factor:company.payouts=view');

    // Stripe Identity
    Route::post('/stripe/identity/session',    [StripeConnectController::class, 'identitySession']);

    // Background checks: basic and complete levels, for carrier owners and drivers (App\Services\Background)
    Route::get('/background',                         [\App\Http\Controllers\Api\BackgroundCheckController::class, 'show']);
    Route::post('/background/pay',                    [\App\Http\Controllers\Api\BackgroundCheckController::class, 'pay']);
    Route::post('/background/checks/{check}/start',   [\App\Http\Controllers\Api\BackgroundCheckController::class, 'start']);
    Route::get('/shipper/carriers/{carrier}/background',  [\App\Http\Controllers\Api\BackgroundCheckController::class, 'shipperShow'])->middleware('perm:shipper:carriers.checks=view');
    Route::post('/shipper/carriers/{carrier}/background', [\App\Http\Controllers\Api\BackgroundCheckController::class, 'shipperOrder'])->middleware('perm:shipper:carriers.order_check');

    // Carrier verification (FMCSA live lookup)
    Route::post('/carrier/verify/dot',         [CarrierVerificationController::class, 'verifyDot'])->middleware('perm:carrier:company.profile');
    Route::post('/carrier/verify/mc',          [CarrierVerificationController::class, 'verifyMc'])->middleware('perm:carrier:company.profile');
    Route::get('/carrier/verifications',       [CarrierVerificationController::class, 'index']);
    // FMCSA public data: insurance, BOC-3, authority history, revocations, SMS (carriers and brokers)
    Route::get('/company/fmcsa-record',        [\App\Http\Controllers\Api\FmcsaRecordController::class, 'show']);

    // FMCSA Drug & Alcohol Clearinghouse
    Route::post('/carrier/clearinghouse',         [ClearinghouseController::class, 'initiate']);
    Route::get('/carrier/clearinghouse/status',   [ClearinghouseController::class, 'status']);

    Route::get('/carrier/documents',           [CarrierController::class, 'getDocuments'])->middleware('perm:carrier:company.profile=view');
    Route::post('/carrier/documents',          [CarrierController::class, 'uploadDocument'])->middleware('perm:carrier:company.profile');
    Route::get('/carrier/vehicles',            [CarrierController::class, 'getVehicles'])->middleware('perm:carrier:fleet.vehicles=view');
    Route::post('/carrier/vehicles',           [CarrierController::class, 'createVehicle'])->middleware('perm:carrier:fleet.vehicles');
    Route::put('/carrier/vehicles/{id}',       [CarrierController::class, 'updateVehicle'])->middleware('perm:carrier:fleet.vehicles');
    Route::delete('/carrier/vehicles/{id}',    [CarrierController::class, 'deleteVehicle'])->middleware('perm:carrier:fleet.vehicles');
    Route::get('/carriers',                    [CarrierController::class, 'index']);

    // Certifications
    Route::put('/carrier/certifications', [CertificationController::class, 'sync'])->middleware('perm:carrier:company.profile');

    // Org / Team management
    Route::get('/org',                             [OrgController::class, 'show']);
    Route::put('/org',                             [OrgController::class, 'update'])->middleware('perm:carrier:company.profile,shipper:company.profile,factor:company.profile');
    // Compliance uploads (W-9, licence, COI...) for the types that keep them as files
    // Operating authorities (DOT / MC / broker) and directory categories of your company
    Route::get('/org/authorities',                 [\App\Http\Controllers\Api\AuthorityController::class, 'index'])->middleware('perm:carrier:company.profile=view,shipper:company.profile=view,factor:company.profile=view');
    Route::post('/org/authorities',                [\App\Http\Controllers\Api\AuthorityController::class, 'store'])->middleware('perm:carrier:company.profile,shipper:company.profile,factor:company.profile');
    Route::put('/org/authorities/{authority}',     [\App\Http\Controllers\Api\AuthorityController::class, 'update'])->middleware('perm:carrier:company.profile,shipper:company.profile,factor:company.profile');
    Route::delete('/org/authorities/{authority}',  [\App\Http\Controllers\Api\AuthorityController::class, 'destroy'])->middleware('perm:carrier:company.profile,shipper:company.profile,factor:company.profile');
    Route::put('/org/categories',                  [\App\Http\Controllers\Api\CapabilityController::class, 'updateOwnCategories'])->middleware('perm:carrier:company.profile,shipper:company.profile,factor:company.profile,receiver:company.profile');
    Route::get('/org/compliance',                  [\App\Http\Controllers\Api\OrgComplianceController::class, 'index'])->middleware('perm:factor:company.profile=view,receiver:company.profile=view');
    Route::post('/org/compliance/{key}',           [\App\Http\Controllers\Api\OrgComplianceController::class, 'upload'])->middleware('perm:factor:company.profile,receiver:company.profile');
    Route::get('/org/remittance',                  [\App\Http\Controllers\Api\OrgRemittanceController::class, 'show'])->middleware('perm:carrier:company.payouts=view,factor:company.payouts=view');
    Route::put('/org/remittance',                  [\App\Http\Controllers\Api\OrgRemittanceController::class, 'update'])->middleware('perm:carrier:company.payouts,factor:company.payouts');
    Route::get('/org/members',                     [OrgController::class, 'members']);
    Route::put('/org/members/{id}',                [OrgController::class, 'updateMember'])->middleware('perm:carrier:team.manage,shipper:team.manage,factor:team.manage,receiver:team.manage');
    Route::delete('/org/members/{id}',             [OrgController::class, 'removeMember'])->middleware('perm:carrier:team.manage,shipper:team.manage,factor:team.manage,receiver:team.manage');
    // A person's own checks: identity record and credentials (docs/people-types-and-checks.md)
    Route::get('/capabilities',                      [\App\Http\Controllers\Api\CapabilityController::class, 'catalog']);
    Route::get('/me/pro-profile',                    [\App\Http\Controllers\Api\ProProfileController::class, 'show']);
    Route::put('/me/pro-profile',                    [\App\Http\Controllers\Api\ProProfileController::class, 'update']);
    Route::get('/me/checks',                         [MyChecksController::class, 'show']);
    Route::put('/me/identity',                       [MyChecksController::class, 'updateIdentity']);
    Route::post('/me/identity/files',                [MyChecksController::class, 'uploadIdentityFile']);
    Route::post('/me/credentials',                   [MyChecksController::class, 'storeCredential']);
    Route::post('/me/credentials/{credential}',      [MyChecksController::class, 'updateCredential']);
    Route::delete('/me/credentials/{credential}',    [MyChecksController::class, 'destroyCredential']);

    Route::get('/org/invitations',                 [OrgController::class, 'invitations'])->middleware('perm:carrier:team.manage,shipper:team.manage,factor:team.manage,receiver:team.manage');
    Route::post('/org/invitations',                [OrgController::class, 'invite'])->middleware('perm:carrier:team.manage,shipper:team.manage,factor:team.manage,receiver:team.manage');
    Route::post('/org/invitations/accept',         [OrgController::class, 'acceptInvitation']);
    Route::post('/org/invitations/{id}/resend',    [OrgController::class, 'resendInvitation'])->middleware('perm:carrier:team.manage,shipper:team.manage,factor:team.manage,receiver:team.manage');
    Route::delete('/org/invitations/{id}',         [OrgController::class, 'cancelInvitation'])->middleware('perm:carrier:team.manage,shipper:team.manage,factor:team.manage,receiver:team.manage');
    Route::put('/org/switch',                      [OrgController::class, 'switchOrg']);
    Route::get('/user/organizations',              [OrgController::class, 'userOrgs']);

    // Shipper subscription (required to post loads)
    Route::get('/shipper/subscription',          [\App\Http\Controllers\Api\SubscriptionController::class, 'show'])->middleware('perm:shipper:company.subscription=view');
    Route::post('/shipper/subscription',         [\App\Http\Controllers\Api\SubscriptionController::class, 'subscribe'])->middleware('perm:shipper:company.subscription');
    Route::post('/shipper/subscription/confirm', [\App\Http\Controllers\Api\SubscriptionController::class, 'confirm'])->middleware('perm:shipper:company.subscription');
    Route::post('/shipper/subscription/cancel',  [\App\Http\Controllers\Api\SubscriptionController::class, 'cancel'])->middleware('perm:shipper:company.subscription');
    Route::post('/shipper/subscription/resume',  [\App\Http\Controllers\Api\SubscriptionController::class, 'resume'])->middleware('perm:shipper:company.subscription');

    // Factor: own Stripe account for factored-load payments
    Route::post('/factor/stripe/connect', [\App\Http\Controllers\Api\FactorStripeController::class, 'connect'])->middleware('perm:factor:company.payouts');
    Route::get('/factor/stripe/status',   [\App\Http\Controllers\Api\FactorStripeController::class, 'status'])->middleware('perm:factor:company.payouts=view');

    // Factoring: NOAs and factored loads, for carrier, factor, shipper and admin (docs/noa-factoring.md)
    Route::get('/factoring/noas',                      [\App\Http\Controllers\Api\FactoringController::class, 'noas'])->middleware('perm:carrier:money.factoring,factor:loads.view=view,shipper:money.payments=view');
    Route::post('/factoring/noas',                     [\App\Http\Controllers\Api\FactoringController::class, 'fileNoa'])->middleware('perm:carrier:money.factoring');
    Route::get('/factoring/noas/{noa}/document',       [\App\Http\Controllers\Api\FactoringController::class, 'document'])->middleware('perm:carrier:money.factoring,factor:loads.view=view,shipper:money.payments=view');
    Route::post('/factoring/noas/{noa}/decide',        [\App\Http\Controllers\Api\FactoringController::class, 'decideNoa'])->middleware('perm:factor:noas.decide')->middleware('company.approved');
    Route::post('/factoring/noas/{noa}/release',       [\App\Http\Controllers\Api\FactoringController::class, 'release'])->middleware('perm:factor:noas.decide')->middleware('company.approved:restricted');
    Route::post('/factoring/noas/{noa}/request-release', [\App\Http\Controllers\Api\FactoringController::class, 'requestRelease'])->middleware('perm:carrier:money.factoring');
    Route::get('/factoring/factors',                   [\App\Http\Controllers\Api\FactoringController::class, 'factors'])->middleware('perm:carrier:money.factoring');
    Route::get('/factoring/eligible-loads',            [\App\Http\Controllers\Api\FactoringController::class, 'eligibleLoads'])->middleware('perm:carrier:money.factoring');
    Route::get('/factoring/loads',                     [\App\Http\Controllers\Api\FactoringController::class, 'loads'])->middleware('perm:carrier:money.factoring,factor:loads.view=view,shipper:money.payments=view');
    Route::post('/factoring/loads',                    [\App\Http\Controllers\Api\FactoringController::class, 'factorLoad'])->middleware('perm:carrier:money.factoring');
    Route::delete('/factoring/loads/{load}',           [\App\Http\Controllers\Api\FactoringController::class, 'withdrawLoad'])->middleware('perm:carrier:money.factoring');
    Route::post('/factoring/loads/{load}/decide',      [\App\Http\Controllers\Api\FactoringController::class, 'decideLoad'])->middleware('perm:factor:loads.decide')->middleware('company.approved:restricted');
    Route::post('/factoring/loads/{load}/acknowledge', [\App\Http\Controllers\Api\FactoringController::class, 'acknowledge'])->middleware('perm:shipper:factoring.acknowledge');

    // Admin: fees (Platform settings)
    Route::put('/admin/settings/fees',    [\App\Http\Controllers\Api\FeesController::class, 'update']);
    Route::get('/admin/integrations',              [\App\Http\Controllers\Api\AdminIntegrationsController::class, 'index']);
    Route::get('/admin/settings/rates',            [\App\Http\Controllers\Api\RateCheckController::class, 'settings']);
    Route::put('/admin/settings/rates',            [\App\Http\Controllers\Api\RateCheckController::class, 'updateSettings']);
    Route::post('/admin/integrations/{key}/test',  [\App\Http\Controllers\Api\AdminIntegrationsController::class, 'test']);
    Route::get('/admin/settings/mode',             [\App\Http\Controllers\Api\PlatformModeController::class, 'show']);
    Route::put('/admin/settings/mode',             [\App\Http\Controllers\Api\PlatformModeController::class, 'update']);
    Route::get('/kyb/countries',                   [\App\Http\Controllers\Api\PlatformModeController::class, 'countries']);
    Route::get('/admin/settings/kyb',              [\App\Http\Controllers\Api\ComplianceChecksController::class, 'settings']);
    Route::put('/admin/settings/kyb',              [\App\Http\Controllers\Api\ComplianceChecksController::class, 'updateSettings']);
    Route::post('/admin/settings/kyb/test',        [\App\Http\Controllers\Api\ComplianceChecksController::class, 'test']);
    Route::post('/admin/companies/{org}/checks/run', [\App\Http\Controllers\Api\ComplianceChecksController::class, 'run']);
    Route::get('/admin/settings/background',       [\App\Http\Controllers\Api\BackgroundCheckController::class, 'settings']);
    Route::put('/admin/settings/background',       [\App\Http\Controllers\Api\BackgroundCheckController::class, 'updateSettings']);
    Route::post('/admin/settings/background/test', [\App\Http\Controllers\Api\BackgroundCheckController::class, 'testConnection']);

    // Load payments and Shipmater revenue (docs/fees-and-billing.md)
    Route::get('/payments',                      [\App\Http\Controllers\Api\PaymentsController::class, 'index'])->middleware('perm:carrier:money.payments=view,shipper:money.payments=view,factor:loads.view=view');
    Route::get('/payments/summary',              [\App\Http\Controllers\Api\PaymentsController::class, 'summary'])->middleware('perm:carrier:money.payments=view,shipper:money.payments=view,factor:loads.view=view');
    Route::get('/payments/fees',                 [\App\Http\Controllers\Api\PaymentsController::class, 'fees'])->middleware('perm:carrier:money.payments=view,shipper:money.payments=view');
    Route::post('/payments/fees/{fee}/retry',    [\App\Http\Controllers\Api\PaymentsController::class, 'retryFee'])->middleware('perm:carrier:money.payments,shipper:money.pay');
    Route::post('/payments/{payment}/retry',     [\App\Http\Controllers\Api\PaymentsController::class, 'retry'])->middleware('perm:shipper:money.pay');
    Route::post('/payments/{payment}/pay-early', [\App\Http\Controllers\Api\PaymentsController::class, 'payEarly'])->middleware('perm:shipper:money.pay');
    Route::get('/admin/ledger',                  [\App\Http\Controllers\Api\AdminFinanceController::class, 'ledger']);
    Route::get('/admin/receivables',             [\App\Http\Controllers\Api\AdminFinanceController::class, 'receivables']);
    Route::get('/admin/settings/payments',       [\App\Http\Controllers\Api\AdminFinanceController::class, 'settings']);
    Route::put('/admin/settings/payments',       [\App\Http\Controllers\Api\AdminFinanceController::class, 'updateSettings']);

    // Shipper profile
    Route::get('/shipper/profile',   [ShipperProfileController::class, 'show']);
    Route::put('/shipper/profile',   [ShipperProfileController::class, 'update']);

    // Shipper verification
    Route::post('/shipper/verify/email/resend',  [ShipperVerificationController::class, 'resendEmail'])
        ->middleware('throttle:5,60');
    Route::post('/shipper/verify/phone/send',    [ShipperVerificationController::class, 'sendPhoneCode'])
        ->middleware('throttle:5,60');
    Route::post('/shipper/verify/phone/confirm', [ShipperVerificationController::class, 'confirmPhoneCode'])
        ->middleware('throttle:10,60');
    Route::get('/shipper/documents',             [ShipperVerificationController::class, 'listDocuments'])->middleware('perm:shipper:company.profile=view');
    Route::post('/shipper/documents',            [ShipperVerificationController::class, 'uploadDocument'])->middleware('perm:shipper:company.profile');
    Route::post('/shipper/verify/business/submit', [ShipperVerificationController::class, 'submitBusiness'])->middleware('perm:shipper:company.profile');

    // Payment methods
    Route::get('/payment-methods',                          [PaymentMethodController::class, 'index'])->middleware('perm:carrier:money.payments=view,shipper:money.payments=view');
    Route::post('/payment-methods/setup-intent',            [PaymentMethodController::class, 'setupIntent'])->middleware('perm:carrier:money.payments,shipper:money.methods');
    Route::post('/payment-methods',                         [PaymentMethodController::class, 'store'])->middleware('perm:carrier:money.payments,shipper:money.methods');
    Route::delete('/payment-methods/{paymentMethod}',       [PaymentMethodController::class, 'destroy'])->middleware('perm:carrier:money.payments,shipper:money.methods');
    Route::post('/payment-methods/{paymentMethod}/default', [PaymentMethodController::class, 'setDefault'])->middleware('perm:carrier:money.payments,shipper:money.methods');

    // Transactions
    Route::get('/transactions', [TransactionController::class, 'index'])->middleware('perm:carrier:money.payments=view,shipper:money.payments=view');

    // Preferred carriers
    Route::get('/preferred-carriers',                       [PreferredCarrierController::class, 'index'])->middleware('perm:shipper:carriers.preferred=view');
    Route::post('/preferred-carriers',                      [PreferredCarrierController::class, 'store'])->middleware('perm:shipper:carriers.preferred');
    Route::delete('/preferred-carriers/{preferredCarrier}', [PreferredCarrierController::class, 'destroy'])->middleware('perm:shipper:carriers.preferred');

    // White-label tenant: self-service branding
    Route::get('/tenant/branding', [TenantController::class, 'show']);
    Route::put('/tenant/branding', [TenantController::class, 'update']);

    // Admin: platform metrics + management
    Route::get('/admin/metrics',   [AdminController::class, 'metrics']);
    Route::get('/admin/shipments', [AdminController::class, 'shipments']);
    Route::get('/admin/shipments/{job}', [AdminController::class, 'shipment']);
    Route::get('/admin/users',     [AdminController::class, 'users']);
    Route::get('/admin/users/{user}',        [AdminController::class, 'user']);
    Route::put('/admin/users/{user}/status', [AdminController::class, 'updateUserStatus']);
    Route::get('/admin/disputes',  [AdminController::class, 'disputes']);

    // Admin: carrier approval queue (pending_review only)
    // People at carrier/shipper companies: identity, background (drivers), credentials, approval (owners + drivers)
    Route::get('/admin/people',                                  [AdminPeopleController::class, 'index']);
    Route::get('/admin/people/{user}',                           [AdminPeopleController::class, 'show']);
    Route::get('/admin/people/{user}/pro-profile',               [\App\Http\Controllers\Api\ProProfileController::class, 'adminShow']);
    Route::post('/admin/people/{user}/identity',                 [AdminPeopleController::class, 'recordIdentity']);
    Route::post('/admin/people/{user}/background',               [AdminPeopleController::class, 'recordBackground']);
    Route::post('/admin/people/{user}/credentials',              [AdminPeopleController::class, 'storeCredential']);
    Route::post('/admin/people/{user}/review',                   [AdminPeopleController::class, 'review']);
    Route::get('/admin/people/{user}/files/{kind}',              [AdminPeopleController::class, 'identityFile']);
    Route::post('/admin/people/credentials/{credential}/verify', [AdminPeopleController::class, 'verifyCredential']);
    Route::delete('/admin/people/credentials/{credential}',      [AdminPeopleController::class, 'destroyCredential']);
    Route::get('/admin/people/credentials/{credential}/file',    [AdminPeopleController::class, 'credentialFile']);

    // Admin: company role matrix (Settings, Roles & Permissions)
    Route::get('/admin/roles/matrix',               [\App\Http\Controllers\Api\AdminRoleController::class, 'show']);
    Route::put('/admin/roles/matrix/{type}',        [\App\Http\Controllers\Api\AdminRoleController::class, 'update']);
    Route::post('/admin/roles/matrix/{type}/reset', [\App\Http\Controllers\Api\AdminRoleController::class, 'reset']);

    // Admin: carrier and shipper companies (organizations)
    Route::get('/admin/subscriptions',              [\App\Http\Controllers\Api\AdminSubscriptionController::class, 'index']);
    Route::get('/admin/subscriptions/{org}',        [\App\Http\Controllers\Api\AdminSubscriptionController::class, 'show']);
    Route::post('/admin/subscriptions/{org}/cancel',[\App\Http\Controllers\Api\AdminSubscriptionController::class, 'cancel']);
    Route::post('/admin/subscriptions/{org}/resume',[\App\Http\Controllers\Api\AdminSubscriptionController::class, 'resume']);
    Route::get('/admin/companies',                  [AdminCompanyController::class, 'index']);
    Route::get('/admin/companies/{org}',            [AdminCompanyController::class, 'show']);
    Route::post('/admin/companies/{org}/review',    [AdminCompanyController::class, 'review']);
    Route::get('/admin/companies/{org}/reviews',    [ReviewController::class, 'adminIndex']);
    Route::post('/admin/reviews/{review}/hide',     [ReviewController::class, 'hide']);
    Route::delete('/admin/reviews/{review}/hide',   [ReviewController::class, 'unhide']);
    Route::get('/admin/companies/{org}/fmcsa-record', [\App\Http\Controllers\Api\FmcsaRecordController::class, 'adminShow']);
    Route::put('/admin/companies/{org}/categories', [\App\Http\Controllers\Api\CapabilityController::class, 'adminUpdateCategories']);
    Route::post('/admin/companies/{org}/authorities', [\App\Http\Controllers\Api\AuthorityController::class, 'adminStore']);
    Route::put('/admin/authorities/{authority}',    [\App\Http\Controllers\Api\AuthorityController::class, 'adminUpdate']);
    // Verification policy (Admin Console, Compliance)
    Route::get('/admin/verification-policy',                      [\App\Http\Controllers\Api\VerificationPolicyController::class, 'show']);
    Route::put('/admin/verification-policy/{type}/checks/{key}',  [\App\Http\Controllers\Api\VerificationPolicyController::class, 'updateCheck']);
    Route::put('/admin/verification-policy/{type}/approval-mode', [\App\Http\Controllers\Api\VerificationPolicyController::class, 'updateApprovalMode']);
    Route::post('/admin/compliance-promotions',                   [\App\Http\Controllers\Api\VerificationPolicyController::class, 'savePromotion']);
    Route::put('/admin/compliance-promotions/{id}',               [\App\Http\Controllers\Api\VerificationPolicyController::class, 'savePromotion']);
    Route::post('/admin/compliance-promotions/{id}/end',          [\App\Http\Controllers\Api\VerificationPolicyController::class, 'endPromotion']);
    Route::post('/admin/companies/{org}/compliance/{key}',        [\App\Http\Controllers\Api\OrgComplianceController::class, 'adminUpload']);
    Route::post('/admin/companies/{org}/compliance/{key}/verify', [\App\Http\Controllers\Api\OrgComplianceController::class, 'verify']);
    Route::get('/admin/claims',                     [DirectoryController::class, 'adminClaims']);
    Route::post('/admin/claims/{claim}/decide',     [DirectoryController::class, 'decideClaim']);
    Route::get('/admin/shippers/pending-review',    [ShipperVerificationController::class, 'pendingReview']);
    Route::post('/admin/shippers/{id}/review',      [ShipperVerificationController::class, 'reviewShipper']);

    // Admin: organization management + Stripe toggle
    Route::get('/admin/orgs',                       [AdminOrgController::class, 'index']);
    Route::get('/admin/orgs/{id}',                  [AdminOrgController::class, 'show']);
    Route::put('/admin/orgs/{id}/stripe',           [AdminOrgController::class, 'updateStripe']);

    // Admin: white-label tenant provisioning
    Route::get('/admin/platform-tenants',           [AdminOrgController::class, 'tenants']);
    Route::post('/admin/platform-tenants',          [AdminOrgController::class, 'createTenant']);
    Route::put('/admin/platform-tenants/{id}',      [AdminOrgController::class, 'updateTenant']);
    Route::post('/admin/leads/{id}/convert',        [AdminOrgController::class, 'convertLead']);

    // Admin: financial reporting
    Route::get('/admin/financials',        [AdminController::class, 'financials']);
    Route::get('/admin/financials/export', [AdminController::class, 'financialsExport']);

    // Ratings & reviews
    Route::post('/jobs/{job}/ratings', [ReviewController::class, 'store'])->middleware('perm:carrier:ratings.give,shipper:ratings.give');
    Route::get('/jobs/{job}/ratings',  [ReviewController::class, 'jobRatings']);
    Route::post('/noas/{noa}/reviews', [ReviewController::class, 'storeNoa']);

    // Blog admin
    Route::get('/admin/blog',         [BlogController::class, 'adminIndex']);
    Route::post('/admin/blog',        [BlogController::class, 'store']);
    Route::put('/admin/blog/{id}',    [BlogController::class, 'update']);
    Route::delete('/admin/blog/{id}', [BlogController::class, 'destroy']);

    // Contracts
    Route::get('/contracts',                         [ContractController::class, 'index'])->middleware('perm:carrier:contracts.view=view,shipper:contracts.edit=view');
    Route::post('/contracts',                        [ContractController::class, 'store'])->middleware('perm:shipper:contracts.edit');
    Route::put('/contracts/{contract}',              [ContractController::class, 'update'])->middleware('perm:shipper:contracts.edit');
    Route::delete('/contracts/{contract}',           [ContractController::class, 'destroy'])->middleware('perm:shipper:contracts.edit');
    Route::get('/contracts/{contract}/agreement',    [ContractController::class, 'agreement'])->middleware('perm:carrier:contracts.view=view,shipper:contracts.edit=view');

    // ── Your company's locations ──────────────────────────────────────────────
    Route::get('/locations',              [LocationController::class, 'index'])->middleware('perm:shipper:locations.manage=view,receiver:locations.manage=view');
    Route::post('/locations',             [LocationController::class, 'store'])->middleware('perm:shipper:locations.manage,receiver:locations.manage');
    Route::put('/locations/{location}',   [LocationController::class, 'update'])->middleware('perm:shipper:locations.manage,receiver:locations.manage');
    Route::delete('/locations/{location}',[LocationController::class, 'destroy'])->middleware('perm:shipper:locations.manage,receiver:locations.manage');
    // Locations to put on a load: your own, your receivers', and public matches
    Route::get('/locations/usable',       [DirectoryController::class, 'usableLocations'])->middleware('perm:shipper:loads.post=view');

    // ── Organizations directory: every company in shipping, their locations and contacts ──
    Route::get('/directory/orgs',                     [DirectoryController::class, 'search']);
    Route::post('/directory/orgs',                    [DirectoryController::class, 'store'])->middleware('perm:shipper:locations.manage');
    Route::get('/directory/orgs/{org}',               [DirectoryController::class, 'show']);
    Route::put('/directory/orgs/{org}',               [DirectoryController::class, 'update'])->middleware('perm:shipper:locations.manage,receiver:company.profile');
    Route::post('/directory/orgs/{org}/locations',    [DirectoryController::class, 'storeLocation'])->middleware('perm:shipper:locations.manage,receiver:locations.manage');
    Route::put('/directory/locations/{location}',     [DirectoryController::class, 'updateLocation'])->middleware('perm:shipper:locations.manage,receiver:locations.manage');
    Route::delete('/directory/locations/{location}',  [DirectoryController::class, 'destroyLocation'])->middleware('perm:shipper:locations.manage,receiver:locations.manage');
    Route::post('/directory/orgs/{org}/contacts',     [DirectoryController::class, 'storeContact'])->middleware('perm:shipper:locations.manage,receiver:contacts.manage');
    Route::put('/directory/contacts/{contact}',       [DirectoryController::class, 'updateContact'])->middleware('perm:shipper:locations.manage,receiver:contacts.manage');
    Route::delete('/directory/contacts/{contact}',    [DirectoryController::class, 'destroyContact'])->middleware('perm:shipper:locations.manage,receiver:contacts.manage');
    Route::post('/directory/orgs/{org}/claim',        [DirectoryController::class, 'claim']);
    // A company's own list of receivers and brokers
    Route::get('/partners',                           [DirectoryController::class, 'partners'])->middleware('perm:shipper:locations.manage=view');
    Route::post('/partners',                          [DirectoryController::class, 'addPartner'])->middleware('perm:shipper:locations.manage');
    Route::delete('/partners/{org}',                  [DirectoryController::class, 'removePartner'])->middleware('perm:shipper:locations.manage');

    // ── Freight jobs (contracted work) ────────────────────────────────────────
    Route::get('/shipper/freight-jobs',                              [FreightJobController::class, 'shipperIndex'])->middleware('perm:shipper:loads.view=view');
    Route::post('/shipper/freight-jobs',                             [FreightJobController::class, 'store'])->middleware('shipper.subscribed')->middleware('perm:shipper:loads.post');
    Route::get('/shipper/freight-jobs/{job}',                        [FreightJobController::class, 'show'])->middleware('perm:shipper:loads.view=view');
    Route::post('/shipper/freight-jobs/{job}/optimise',              [FreightJobController::class, 'optimise'])->middleware('perm:shipper:loads.post');
    Route::patch('/shipper/freight-jobs/{job}/billing',              [FreightJobController::class, 'saveBilling'])->middleware('perm:shipper:loads.post');
    Route::patch('/shipper/freight-jobs/{job}/terms',                [FreightJobController::class, 'saveTerms'])->middleware('perm:shipper:loads.post');
    Route::patch('/shipper/freight-jobs/{job}/requirements',         [FreightJobController::class, 'saveRequirements'])->middleware('perm:shipper:loads.post');
    // Rate check: market rate guidance (App\Services\Rates\RateEstimator)
    Route::post('/rates/check',                                      [\App\Http\Controllers\Api\RateCheckController::class, 'check'])->middleware(['perm:shipper:loads.post', 'throttle:30,1']);
    Route::get('/rates/checks',                                      [\App\Http\Controllers\Api\RateCheckController::class, 'history'])->middleware('perm:shipper:loads.post');
    Route::get('/shipper/freight-jobs/{job}/market-rate',            [\App\Http\Controllers\Api\RateCheckController::class, 'forJob'])->middleware('perm:shipper:loads.post');
    Route::get('/shipper/freight-jobs/{job}/matches',                [FreightJobController::class, 'matches'])->middleware('perm:shipper:loads.view=view');
    Route::post('/shipper/freight-jobs/{job}/post',                  [FreightJobController::class, 'post'])->middleware('perm:shipper:loads.post')->middleware('company.approved');
    Route::get('/jobs/{job}/rate-confirmation',                      [FreightJobController::class, 'rateConfirmation'])->middleware('perm:carrier:trips.documents=view,shipper:loads.view=view');
    Route::get('/jobs/{job}/bol',                                    [FreightJobController::class, 'bol'])->middleware('perm:carrier:trips.documents=view,shipper:loads.view=view');
    Route::get('/jobs/{job}/invoice',                                [FreightJobController::class, 'invoice'])->middleware('perm:carrier:trips.documents=view,shipper:loads.view=view');

    // Evidence (photos) per stop — shipper or assigned carrier
    Route::get('/jobs/{job}/stops/{stop}/evidence',                  [EvidenceController::class, 'index'])->middleware('perm:carrier:loads.view=view,shipper:loads.view=view');
    Route::post('/jobs/{job}/stops/{stop}/evidence',                 [EvidenceController::class, 'store'])->middleware('perm:carrier:trips.stops')->middleware('company.approved:restricted');
    Route::post('/jobs/{job}/stops/{stop}/signature',                [EvidenceController::class, 'signature'])->middleware('perm:carrier:trips.stops')->middleware('company.approved:restricted');
    Route::delete('/jobs/{job}/evidence/{evidence}',                 [EvidenceController::class, 'destroy'])->middleware('perm:carrier:trips.stops,shipper:loads.post');

    // POD — view (inline) or download
    Route::get('/jobs/{job}/stops/{stop}/pod',                       [EvidenceController::class, 'downloadPod'])->middleware('perm:carrier:trips.documents=view,shipper:loads.view=view');
    Route::post('/jobs/{job}/stops/{stop}/pod',                      [EvidenceController::class, 'generatePod'])->middleware('perm:carrier:trips.stops')->middleware('company.approved:restricted');

    Route::get('/carrier/freight-jobs',                              [FreightJobController::class, 'carrierIndex'])->middleware('perm:carrier:loads.board=view');
    Route::get('/carrier/freight-jobs/{job}',                        [FreightJobController::class, 'carrierShow'])->middleware('perm:carrier:loads.view=view');
    Route::patch('/carrier/freight-jobs/{job}/stops/{stop}',         [FreightJobController::class, 'updateStop'])->middleware('perm:carrier:trips.stops')->middleware('company.approved:restricted');
    // Carrier: my offers across all jobs
    Route::get('/carrier/my-offers',                                 [FreightJobOfferController::class, 'carrierMyOffers'])->middleware('perm:carrier:loads.board=view');
    // Carrier offers per job
    Route::get('/carrier/freight-jobs/{job}/offers/mine',            [FreightJobOfferController::class, 'mine'])->middleware('perm:carrier:loads.board=view');
    Route::post('/carrier/freight-jobs/{job}/offers',                [FreightJobOfferController::class, 'store'])->middleware('perm:carrier:loads.bid')->middleware('company.approved');
    Route::delete('/carrier/freight-jobs/{job}/offers/{offer}',      [FreightJobOfferController::class, 'withdraw'])->middleware('perm:carrier:loads.bid')->middleware('company.approved');

    // Shipper: view + act on offers
    Route::get('/shipper/offers',                                    [FreightJobOfferController::class, 'shipperAllOffers'])->middleware('perm:shipper:loads.view=view');
    Route::get('/shipper/freight-jobs/{job}/offers',                 [FreightJobOfferController::class, 'index'])->middleware('perm:shipper:loads.view=view');
    Route::post('/shipper/freight-jobs/{job}/offers/{offer}/accept', [FreightJobOfferController::class, 'accept'])->middleware('perm:shipper:loads.decide')->middleware('company.approved');
    Route::post('/shipper/freight-jobs/{job}/offers/{offer}/decline',[FreightJobOfferController::class, 'decline'])->middleware('perm:shipper:loads.decide')->middleware('company.approved');


    // ── Ratings ────────────────────────────────────────────────────────────
    Route::post('/jobs/{job}/ratings', [ReviewController::class, 'store'])->middleware('perm:carrier:ratings.give,shipper:ratings.give');
    Route::get('/jobs/{job}/ratings',  [ReviewController::class, 'jobRatings']);
});
