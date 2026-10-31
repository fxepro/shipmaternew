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

    'fmcsa' => [
        'key' => env('FMCSA_API_KEY'),
    ],

    'checkr' => [
        'key'            => env('CHECKR_API_KEY'),
        'webhook_secret' => env('CHECKR_WEBHOOK_SECRET'),
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
