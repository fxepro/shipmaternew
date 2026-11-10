<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'stripe' => [
        'secret'         => env('STRIPE_SECRET_KEY'),
        'webhook_secret' => env('STRIPE_WEBHOOK_SECRET'),
        // Connected-account events (load payments on carrier and factor Stripe accounts)
        'connect_webhook_secret' => env('STRIPE_CONNECT_WEBHOOK_SECRET'),
    ],

    'plaid' => [
        'client_id' => env('PLAID_CLIENT_ID'),
        'secret'    => env('PLAID_SECRET'),
        'env'       => env('PLAID_ENV', 'sandbox'),
    ],

    // Business verification (KYB), demo/compliance-checks.html
    'middesk' => [
        'test_key'       => env('MIDDESK_TEST_KEY', ''),
        'live_key'       => env('MIDDESK_LIVE_KEY', ''),
        'webhook_secret' => env('MIDDESK_WEBHOOK_SECRET', ''),
    ],

    // Business verification backup (app/Services/Checks/DiditKyb.php); one key per Didit application, sandbox or live
    'didit' => [
        'key'            => env('DIDIT_API_KEY', ''),
        'webhook_secret' => env('DIDIT_WEBHOOK_SECRET', ''),
    ],

    'sam_gov' => [
        'key' => env('SAM_GOV_API_KEY', ''),
    ],

    'fmcsa' => [
        'key' => env('FMCSA_API_KEY'),
    ],

    // Background check providers (App\Services\Background). Admin → Settings picks the provider, the mode
    // (test or live) and the package for each level; only the keys live here.
    // Checkr signs webhooks with the API key itself, so there is no separate webhook secret.
    'checkr' => [
        'test_key' => env('CHECKR_TEST_KEY', env('CHECKR_API_KEY')),
        'live_key' => env('CHECKR_LIVE_KEY'),
        'test_url' => env('CHECKR_TEST_URL', 'https://api.checkr-staging.com/v1'),
        'live_url' => env('CHECKR_LIVE_URL', 'https://api.checkr.com/v1'),
        'package'  => env('CHECKR_PACKAGE'),
    ],

    // Foley's API is documented only to account holders; the URLs below are from Foley's integration notes.
    'foley' => [
        'test_key'       => env('FOLEY_TEST_KEY'),
        'live_key'       => env('FOLEY_LIVE_KEY'),
        'account_id'     => env('FOLEY_ACCOUNT_ID'),
        'webhook_secret' => env('FOLEY_WEBHOOK_SECRET'),
        'test_url'       => env('FOLEY_TEST_URL', 'https://api.sandbox.foley.io'),
        'live_url'       => env('FOLEY_LIVE_URL', 'https://api.foley.io'),
    ],

    'clearinghouse' => [
        'url'            => env('CLEARINGHOUSE_API_URL', 'https://clearinghouse.fmcsa.dot.gov/api/v1'),
        'api_key'        => env('CLEARINGHOUSE_API_KEY'),
        'org_id'         => env('CLEARINGHOUSE_ORG_ID'),
        'webhook_secret' => env('CLEARINGHOUSE_WEBHOOK_SECRET'),
    ],

    'twilio' => [
        'sid'        => env('TWILIO_ACCOUNT_SID'),
        'token'      => env('TWILIO_AUTH_TOKEN'),
        'from'       => env('TWILIO_FROM'),
        'verify_sid' => env('TWILIO_VERIFY_SID'),
    ],

];
