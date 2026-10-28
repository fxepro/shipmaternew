# Deploying Shipmater

```
Browser ──► Netlify (Next.js)  ──/api/* proxy──►  Railway: API (Laravel, api/Dockerfile)
                                                        │
                                                        ▼
                                                  Railway: Postgres
```

- **Netlify** builds the Next.js app from the repo root (`netlify.toml`).
- **Railway** runs two services in one project: the Laravel API (`api/railway.toml` + `api/Dockerfile`)
  and a Postgres database.
- The browser only talks to the Netlify domain. `app/api/[...path]/route.ts` forwards `/api/*` to
  Railway at request time, so the API URL can change without rebuilding the frontend.

---

## 1. Railway — Postgres

1. Create a project → **New** → **Database** → **PostgreSQL**.
2. Nothing else to configure. It exposes `DATABASE_URL` for the API service to reference.

## 2. Railway — API service

1. **New** → **GitHub Repo** → `fxepro/shipmaternew`.
2. Service **Settings**:
   - **Root Directory**: `/api` (so `api/railway.toml` and `api/Dockerfile` are used)
   - **Networking** → **Generate Domain** (e.g. `shipmater-api.up.railway.app`)
3. **Variables** (minimum to boot):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference variable) |
   | `DB_CONNECTION` | `pgsql` |
   | `APP_NAME` | `Shipmater` |
   | `APP_ENV` | `production` |
   | `APP_DEBUG` | `false` |
   | `APP_KEY` | output of `php artisan key:generate --show` (a new one, not your local key) |
   | `APP_URL` | `https://<api-domain>.up.railway.app` |
   | `FRONTEND_URL` | `https://<site>.netlify.app` (or the custom domain) |
   | `CORS_ALLOWED_ORIGINS` | `https://<site>.netlify.app` (comma-separated if more) |
   | `LOG_CHANNEL` | `stderr` |
   | `SESSION_DRIVER` / `CACHE_STORE` / `QUEUE_CONNECTION` | `database` / `database` / `sync` |

   Add when you need the feature (names in `api/.env.example` and `api/config/services.php`):
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CHECKR_API_KEY`, `CHECKR_WEBHOOK_SECRET`,
   `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`, `MAIL_*`, and document storage
   (`DOCUMENT_DRIVER=s3` + `DOCUMENT_S3_*` / Cloudflare R2 keys).

4. Deploy. On each boot the container runs, in order:
   `config:cache` → `route:cache` → `storage:link` → `migrate --force` →
   `ServiceTypeSeeder` → `CertificationSeeder` → `OrganizationMigrationSeeder` → `serve`.
   Demo data (`DatabaseSeeder`) is **not** run in production.
5. Check: `https://<api-domain>.up.railway.app/up` returns 200.

> Migrations skip `database/schema/pgsql-schema.sql` (it needs the `psql` client, which the image
> doesn't have) and run all 69 migrations instead. This was verified locally to produce a schema
> identical to the dump.

## 3. Netlify — frontend

1. **Add new site** → **Import from Git** → `fxepro/shipmaternew` (base directory: repo root).
   Build command and publish directory come from `netlify.toml`.
2. **Environment variables**:

   | Variable | Value |
   |---|---|
   | `API_PROXY_URL` | `https://<api-domain>.up.railway.app` (https, no trailing slash, no `/api`) |
   | `NEXT_PUBLIC_APP_HOST` | `app.shipmater.com` |
   | `NEXT_PUBLIC_MAPTILER_KEY` | MapTiler key |
   | `NEXT_PUBLIC_STRIPE_PK` | `pk_test_…` until launch |

   `NEXT_PUBLIC_API_PROXY=true` is already set in `netlify.toml`.
   `NEXT_PUBLIC_*` values are baked in at build time — trigger a redeploy after changing them.
3. Deploy, then put the Netlify URL into the Railway API's `FRONTEND_URL` and `CORS_ALLOWED_ORIGINS`.

## 4. Smoke test

- `https://<site>.netlify.app` loads.
- Register a new account, or seed demo users once from the Railway API service shell:
  `php artisan db:seed --class=DatabaseSeeder --force` then
  `php artisan db:seed --class=OrganizationMigrationSeeder --force`
  (demo logins are in `demo/users` — only do this on a non-production database).
- Log in → dashboard loads → network tab shows `/api/v1/...` calls returning 200.

## Not covered yet

- **Reverb (real-time GPS / notifications)** needs its own Railway service running
  `php artisan reverb:start`, plus `REVERB_*` on the API and `NEXT_PUBLIC_REVERB_*` on Netlify.
- **File storage**: Railway's disk is wiped on every deploy. Use R2/S3 (`DOCUMENT_DRIVER=s3`) before
  real users upload POD photos and documents.
- **Web server**: the container uses `php artisan serve` (single process). Fine for staging; switch to
  FrankenPHP / Octane or nginx + php-fpm before real traffic.
- **Webhooks**: point Stripe and Checkr webhooks at `https://<api-domain>/api/...` once keys are set.
