<?php

$localOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
];

$productionOrigins = [
    'https://shipmater.com',
    'https://www.shipmater.com',
];

$extraOrigins = env('CORS_ALLOWED_ORIGINS')
    ? array_map('trim', explode(',', env('CORS_ALLOWED_ORIGINS')))
    : [];

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    | Allows the Next.js frontend (local + production) to call this API.
    | Override or extend via CORS_ALLOWED_ORIGINS (comma-separated) on Railway.
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_values(array_unique(array_filter(array_merge(
        $localOrigins,
        $productionOrigins,
        $extraOrigins,
    )))),

    // LAN dev only — disabled in production when APP_ENV=production.
    'allowed_origins_patterns' => env('APP_ENV') === 'local' ? [
        '#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#',
        '#^https?://192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$#',
        '#^https?://10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$#',
    ] : [],

    'allowed_headers' => ['*'],

    'exposed_headers' => ['Content-Disposition'],   // so PDF downloads keep their file name

    'max_age' => 0,

    /** Bearer-token API — no cookies sent from the Next.js client. */
    'supports_credentials' => false,

];
