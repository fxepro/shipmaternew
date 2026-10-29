<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BidController;
use App\Http\Controllers\Api\CarrierController;
use App\Http\Controllers\Api\PlaidController;
use App\Http\Controllers\Api\ShipperPaymentController;
use App\Http\Controllers\Api\CarrierVerificationController;
use App\Http\Controllers\Api\ClearinghouseController;
use App\Http\Controllers\Api\StripeConnectController;
use App\Http\Controllers\Api\ContractController;
use App\Http\Controllers\Api\FreightJobController;
use App\Http\Controllers\Api\FreightJobOfferController;
use App\Http\Controllers\Api\LocationController;
use App\Http\Controllers\Api\JobController;
use App\Http\Controllers\Api\PaymentMethodController;
use App\Http\Controllers\Api\PreferredCarrierController;
use App\Http\Controllers\Api\ShipmentController;
use App\Http\Controllers\Api\ShipperProfileController;
use App\Http\Controllers\Api\BlogController;
use App\Http\Controllers\Api\CertificationController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\EvidenceController;
use App\Http\Controllers\Api\TenantController;
use App\Http\Controllers\Api\AdminOrgController;
use App\Http\Controllers\Api\OrgController;
use App\Http\Controllers\Api\PlatformLeadController;
use App\Http\Controllers\Api\RatingController;
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

// ── Checkr webhook (public — Checkr signs it) ─────────────────────────
Route::post('/checkr/webhook', [CarrierVerificationController::class, 'checkrWebhook']);

// ── Clearinghouse webhook (public — FMCSA signs it) ───────────────────
Route::post('/clearinghouse/webhook', [ClearinghouseController::class, 'webhook']);

// ── Broadcasting auth ─────────────────────────────────────────────────
Route::post('/broadcasting/auth', function (\Illuminate\Http\Request $request) {
    return \Illuminate\Support\Facades\Broadcast::auth($request);
})->middleware('auth:sanctum');

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
Route::get('/orgs/{org}/ratings', [RatingController::class, 'profileRatings']);

// ── Ratings: org profile (public) ──────────────────────────────────────────
Route::get('/orgs/{org}/ratings', [RatingController::class, 'profileRatings']);

// ── Auth (public) ──────────────────────────────────────────────────────────
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login',    [AuthController::class, 'login']);
Route::post('/auth/email/verify', [AuthController::class, 'verifyEmail'])
    ->middleware('throttle:10,1');

// ── Authenticated ──────────────────────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    // Current user
    Route::get('/user',          [AuthController::class, 'user']);
    Route::post('/auth/logout',  [AuthController::class, 'logout']);

    // Shipments
    Route::get('/shipments',                         [ShipmentController::class, 'index']);
    Route::post('/shipments',                        [ShipmentController::class, 'store']);
    Route::get('/shipments/{shipment}',              [ShipmentController::class, 'show']);
    Route::put('/shipments/{shipment}/accept-offer', [ShipmentController::class, 'acceptOffer']);
    Route::put('/shipments/{shipment}/decline-offer',[ShipmentController::class, 'declineOffer']);

    // Bids
    Route::get('/shipments/{shipment}/bids',  [BidController::class, 'index']);
    Route::post('/shipments/{shipment}/bids', [BidController::class, 'store']);
    // ── Carrier operational routes — requires approved status ─────────────
    Route::middleware('carrier.approved')->group(function () {
        Route::get('/jobs',               [JobController::class, 'index']);
        Route::get('/carrier/offers',     [BidController::class, 'carrierOffers']);
        Route::get('/carrier/earnings',   [CarrierController::class, 'earnings']);
        Route::post('/carrier/payout',    [CarrierController::class, 'requestPayout']);
        Route::post('/shipments/{shipment}/deliver', [ShipmentController::class, 'deliver']);
        Route::put('/shipments/{shipment}/start',    [ShipmentController::class, 'start']);
        Route::post('/shipments/{shipment}/ping',    [ShipmentController::class, 'ping']);
        Route::put('/bids/{bid}/withdraw',           [BidController::class, 'withdraw']);
    });

    // Carrier: profile, documents, vehicles (always accessible)
    Route::get('/carrier/kyc-status',          [CarrierController::class, 'kycStatus']);
    Route::get('/carrier/profile',             [CarrierController::class, 'show']);
    Route::put('/carrier/profile',             [CarrierController::class, 'update']);

    // Stripe Connect
    Route::post('/stripe/connect/onboard',     [StripeConnectController::class, 'onboard']);
    Route::get('/stripe/connect/status',       [StripeConnectController::class, 'status']);

    // Stripe Identity
    Route::post('/stripe/identity/session',    [StripeConnectController::class, 'identitySession']);

    // Carrier onboarding fee ($99)
    Route::post('/stripe/onboarding-fee',      [StripeConnectController::class, 'onboardingFee']);

    // Carrier verification (FMCSA live lookup + Checkr background check)
    Route::post('/carrier/verify/dot',         [CarrierVerificationController::class, 'verifyDot']);
    Route::post('/carrier/verify/mc',          [CarrierVerificationController::class, 'verifyMc']);
    Route::post('/carrier/background-check',   [CarrierVerificationController::class, 'initiateBackgroundCheck']);
    Route::get('/carrier/verifications',       [CarrierVerificationController::class, 'index']);

    // FMCSA Drug & Alcohol Clearinghouse
    Route::post('/carrier/clearinghouse',         [ClearinghouseController::class, 'initiate']);
    Route::get('/carrier/clearinghouse/status',   [ClearinghouseController::class, 'status']);

    Route::get('/carrier/documents',           [CarrierController::class, 'getDocuments']);
    Route::post('/carrier/documents',          [CarrierController::class, 'uploadDocument']);
    Route::get('/carrier/vehicles',            [CarrierController::class, 'getVehicles']);
    Route::post('/carrier/vehicles',           [CarrierController::class, 'createVehicle']);
    Route::put('/carrier/vehicles/{id}',       [CarrierController::class, 'updateVehicle']);
    Route::delete('/carrier/vehicles/{id}',    [CarrierController::class, 'deleteVehicle']);
    Route::get('/carriers',                    [CarrierController::class, 'index']);

    // Certifications
    Route::put('/carrier/certifications', [CertificationController::class, 'sync']);

    // Org / Team management
    Route::get('/org',                             [OrgController::class, 'show']);
    Route::put('/org',                             [OrgController::class, 'update']);
    Route::get('/org/members',                     [OrgController::class, 'members']);
    Route::put('/org/members/{id}',                [OrgController::class, 'updateMember']);
    Route::delete('/org/members/{id}',             [OrgController::class, 'removeMember']);
    Route::get('/org/invitations',                 [OrgController::class, 'invitations']);
    Route::post('/org/invitations',                [OrgController::class, 'invite']);
    Route::post('/org/invitations/accept',         [OrgController::class, 'acceptInvitation']);
    Route::delete('/org/invitations/{id}',         [OrgController::class, 'cancelInvitation']);
    Route::put('/org/switch',                      [OrgController::class, 'switchOrg']);
    Route::get('/user/organizations',              [OrgController::class, 'userOrgs']);

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
    Route::get('/shipper/documents',             [ShipperVerificationController::class, 'listDocuments']);
    Route::post('/shipper/documents',            [ShipperVerificationController::class, 'uploadDocument']);
    Route::post('/shipper/verify/business/submit', [ShipperVerificationController::class, 'submitBusiness']);

    // Payment methods
    Route::get('/payment-methods',                          [PaymentMethodController::class, 'index']);
    Route::post('/payment-methods',                         [PaymentMethodController::class, 'store']);
    Route::delete('/payment-methods/{paymentMethod}',       [PaymentMethodController::class, 'destroy']);
    Route::post('/payment-methods/{paymentMethod}/default', [PaymentMethodController::class, 'setDefault']);

    // Transactions
    Route::get('/transactions', [TransactionController::class, 'index']);

    // Preferred carriers
    Route::get('/preferred-carriers',                       [PreferredCarrierController::class, 'index']);
    Route::post('/preferred-carriers',                      [PreferredCarrierController::class, 'store']);
    Route::delete('/preferred-carriers/{preferredCarrier}', [PreferredCarrierController::class, 'destroy']);

    // White-label tenant: self-service branding
    Route::get('/tenant/branding', [TenantController::class, 'show']);
    Route::put('/tenant/branding', [TenantController::class, 'update']);

    // Admin: platform metrics + management
    Route::get('/admin/metrics',   [AdminController::class, 'metrics']);
    Route::get('/admin/shipments', [AdminController::class, 'shipments']);
    Route::get('/admin/shipments/{shipment}', [AdminController::class, 'shipment']);
    Route::get('/admin/users',     [AdminController::class, 'users']);
    Route::get('/admin/disputes',  [AdminController::class, 'disputes']);

    // Admin: carrier approval queue (pending_review only)
    Route::get('/admin/carriers/pending-review',    [CarrierController::class, 'pendingReview']);
    Route::post('/admin/carriers/{id}/review',      [CarrierController::class, 'reviewCarrier']);
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
    Route::post('/jobs/{job}/ratings', [RatingController::class, 'store']);
    Route::get('/jobs/{job}/ratings',  [RatingController::class, 'jobRatings']);

    // Blog admin
    Route::get('/admin/blog',         [BlogController::class, 'adminIndex']);
    Route::post('/admin/blog',        [BlogController::class, 'store']);
    Route::put('/admin/blog/{id}',    [BlogController::class, 'update']);
    Route::delete('/admin/blog/{id}', [BlogController::class, 'destroy']);

    // Contracts
    Route::get('/contracts',                         [ContractController::class, 'index']);
    Route::post('/contracts',                        [ContractController::class, 'store']);
    Route::put('/contracts/{contract}',              [ContractController::class, 'update']);
    Route::delete('/contracts/{contract}',           [ContractController::class, 'destroy']);
    Route::get('/contracts/{contract}/agreement',    [ContractController::class, 'agreement']);

    // ── Locations address book ────────────────────────────────────────────────
    Route::get('/locations',              [LocationController::class, 'index']);
    Route::post('/locations',             [LocationController::class, 'store']);
    Route::put('/locations/{location}',   [LocationController::class, 'update']);
    Route::delete('/locations/{location}',[LocationController::class, 'destroy']);

    // ── Freight jobs (contracted work) ────────────────────────────────────────
    Route::get('/shipper/freight-jobs',                              [FreightJobController::class, 'shipperIndex']);
    Route::post('/shipper/freight-jobs',                             [FreightJobController::class, 'store']);
    Route::get('/shipper/freight-jobs/{job}',                        [FreightJobController::class, 'show']);
    Route::post('/shipper/freight-jobs/{job}/optimise',              [FreightJobController::class, 'optimise']);
    Route::patch('/shipper/freight-jobs/{job}/billing',              [FreightJobController::class, 'saveBilling']);
    Route::patch('/shipper/freight-jobs/{job}/terms',                [FreightJobController::class, 'saveTerms']);
    Route::post('/shipper/freight-jobs/{job}/post',                  [FreightJobController::class, 'post']);
    Route::get('/jobs/{job}/rate-confirmation',                      [FreightJobController::class, 'rateConfirmation']);
    Route::get('/jobs/{job}/bol',                                    [FreightJobController::class, 'bol']);
    Route::get('/jobs/{job}/invoice',                                [FreightJobController::class, 'invoice']);

    // Evidence (photos) per stop — shipper or assigned carrier
    Route::get('/jobs/{job}/stops/{stop}/evidence',                  [EvidenceController::class, 'index']);
    Route::post('/jobs/{job}/stops/{stop}/evidence',                 [EvidenceController::class, 'store']);
    Route::post('/jobs/{job}/stops/{stop}/signature',                [EvidenceController::class, 'signature']);
    Route::delete('/jobs/{job}/evidence/{evidence}',                 [EvidenceController::class, 'destroy']);

    // POD — view (inline) or download
    Route::get('/jobs/{job}/stops/{stop}/pod',                       [EvidenceController::class, 'downloadPod']);
    Route::post('/jobs/{job}/stops/{stop}/pod',                      [EvidenceController::class, 'generatePod']);

    Route::get('/carrier/freight-jobs',                              [FreightJobController::class, 'carrierIndex']);
    Route::get('/carrier/freight-jobs/{job}',                        [FreightJobController::class, 'carrierShow']);
    Route::patch('/carrier/freight-jobs/{job}/stops/{stop}',         [FreightJobController::class, 'updateStop']);
    // Carrier: my offers across all jobs
    Route::get('/carrier/my-offers',                                 [FreightJobOfferController::class, 'carrierMyOffers']);
    // Carrier offers per job
    Route::get('/carrier/freight-jobs/{job}/offers/mine',            [FreightJobOfferController::class, 'mine']);
    Route::post('/carrier/freight-jobs/{job}/offers',                [FreightJobOfferController::class, 'store']);
    Route::delete('/carrier/freight-jobs/{job}/offers/{offer}',      [FreightJobOfferController::class, 'withdraw']);

    // Shipper: view + act on offers
    Route::get('/shipper/offers',                                    [FreightJobOfferController::class, 'shipperAllOffers']);
    Route::get('/shipper/freight-jobs/{job}/offers',                 [FreightJobOfferController::class, 'index']);
    Route::post('/shipper/freight-jobs/{job}/offers/{offer}/accept', [FreightJobOfferController::class, 'accept']);
    Route::post('/shipper/freight-jobs/{job}/offers/{offer}/decline',[FreightJobOfferController::class, 'decline']);

    // ── Freight payments (shipper) ─────────────────────────────────────────
    // Step 1: create PaymentIntent before accepting a bid
    Route::post('/bids/{bid}/payment-intent', [ShipperPaymentController::class, 'createIntent']);
    // Step 2: accept bid (after Stripe confirms authorization)
    Route::put('/bids/{bid}/accept',          [ShipperPaymentController::class, 'accept']);
    // Direct payment for contracted / pre-agreed shipments
    Route::post('/shipper/pay/{shipment}',    [ShipperPaymentController::class, 'payShipment']);

    // ── Plaid / ACH bank connection (shipper) ──────────────────────────────
    Route::get('/shipper/plaid/link-token',    [PlaidController::class, 'linkToken']);
    Route::post('/shipper/plaid/exchange',     [PlaidController::class, 'exchange']);
    Route::get('/shipper/plaid/status',        [PlaidController::class, 'status']);
    Route::delete('/shipper/plaid/disconnect', [PlaidController::class, 'disconnect']);

    // ── Ratings ────────────────────────────────────────────────────────────
    Route::post('/jobs/{job}/ratings', [RatingController::class, 'store']);
    Route::get('/jobs/{job}/ratings',  [RatingController::class, 'jobRatings']);
});
