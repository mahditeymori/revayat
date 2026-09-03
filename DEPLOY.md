# Deployment

```
Laptop  ──git push──▶  GitHub (private)  ──Actions──▶  GHCR image
                                                          │
                                                          ▼
                                              Server: git pull + deploy.sh
```

The server never builds. GitHub Actions typechecks, tests, builds the image and
pushes it to GHCR; the server pulls that exact image by tag. A Next.js build on a
small VM is memory-hungry, and a build that fails there would take the live site
down with it.

## Server setup (once)

```bash
git clone git@github.com:mahditeymori/revayat.git /srv/revayat
cd /srv/revayat
cp .env.example .env
$EDITOR .env          # real values — this file must never be committed
```

`.env` on the server holds:

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://revayat.shop` — wrong value breaks SEO and canonical URLs |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | provisions the `db` compose service; `web`'s `DATABASE_URL` is built from these automatically in `docker-compose.yml` |
| `ADMIN_SESSION_SECRET` | signs admin session tokens — long random string, e.g. `openssl rand -base64 32` |
| `ZIBAL_MERCHANT` | payment gateway merchant id — `deploy.sh` refuses to deploy without it (see Payments section) |
| `NEXT_PUBLIC_ENAMAD_CODE` | optional |
| `CERT_DOMAIN` | defaults to `revayat.shop` |
| `BACKUP_RETENTION_DAYS` | defaults to `14` — pruning window for the `backup` service's scheduled `pg_dump` |

Full list with placeholders: `.env.example` (repo root).

Log in to GHCR so the server can pull the private image:

```bash
echo "$GITHUB_TOKEN" | docker login ghcr.io -u mahditeymori --password-stdin
```

### First certificate

The stack boots with a self-signed placeholder so nginx starts before any real
certificate exists. Replace it once DNS points at the server:

```bash
docker compose up -d
docker compose run --rm certbot certonly --webroot -w /var/www/certbot \
  -d revayat.shop -d www.revayat.shop --agree-tos -m you@example.com
docker compose restart nginx
```

Renewal is automatic from then on — the certbot container renews every 12h and
nginx reloads on the same interval.

### Database migrations and first-time catalog import

Schema migrations run automatically, every boot, before the app starts
(`apps/web/docker-entrypoint.sh` → `node scripts/migrate.mjs`). Drizzle tracks
what's applied in its own table, so this is idempotent — nothing to do here.

The legacy flat-JSON catalog (`apps/web/data/products.json`,
`apps/web/data/settings.json`) is **not** migrated automatically — that only
happens once, on purpose, via `npm run migrate:legacy-json`. The production
image doesn't ship the script's source deps (by design — see
`apps/web/Dockerfile`'s runner stage, which only carries `migrate.mjs`), so run
it from the full repo checkout on the server, attached to the compose
network, pointed at the `db` service by name:

```bash
cd /srv/revayat/apps/web
npm ci
DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:5432/$POSTGRES_DB" \
  docker compose -f ../../docker-compose.yml run --rm --no-deps \
  -v "$PWD":/app -w /app node:22-alpine \
  sh -c "npm ci && npm run migrate:legacy-json"
```

Simpler in practice: temporarily add `ports: ['127.0.0.1:5432:5432']` to the
`db` service (or reuse `docker-compose.override.yml` locally against a
production DB dump) and run `npm run migrate:legacy-json` directly from the
checkout with `DATABASE_URL=postgresql://…@localhost:5432/…` in `.env.local`.
Revert the port mapping afterward — `db` is not meant to be reachable from
outside the compose network in production.

It's an upsert on category slug and an existence-check-then-skip on product
slug — safe to re-run, and re-running after a product already exists will
**not** update that product's data or variants. Migrated stock is a
placeholder (`LEGACY_MIGRATION_DEFAULT_STOCK`, default 20 per variant, not a
real inventory count) — correct real per-variant stock via
**مدیریت → موجودی** before taking real orders.

If this is a brand-new database, also bootstrap the first admin account —
`npm run db:seed-admin` (same run pattern as above), refuses to run if any
admin row already exists.

## The everyday checklist

Normal change, laptop → live:

```bash
cd apps/web
npm run typecheck && npm test          # 1. must pass before pushing
npm run dev                            # 2. look at it
cd ../.. && git add -A && git commit -m "…" && git push
```

3. Watch the run: GitHub → Actions. It typechecks, tests, builds, pushes to
   GHCR, then SSHes in and runs `deploy.sh`.
4. Confirm: `curl -I https://revayat.shop` → `200`.

If Actions is red the server was never touched — the live site is still the
previous image. Fix and push again.

**Content-only changes** (prices, stock, hero text, product photos) go through
the admin panel at `/admin`. They write to the data volume and take effect
immediately — no push, no deploy, no restart.

## Deploying

Push to `main`. GitHub Actions builds, pushes, and runs `deploy.sh` on the server.

Manually, on the server:

```bash
git pull
./deploy.sh ghcr.io/mahditeymori/revayat-web:<sha>
```

`deploy.sh` pulls the image, starts it, waits for the container healthcheck, and
**automatically reverts to the previous image if it never turns healthy**. The
tag currently deployed is recorded in `.deploy-image`.

### Rollback

```bash
./rollback.sh                                    # previous image
./deploy.sh ghcr.io/mahditeymori/revayat-web:<older-sha>   # a specific one
```

Rollback is a retag and restart — no rebuild. Data is untouched.

## GitHub secrets

Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `SSH_HOST` | server IP or hostname |
| `SSH_USER` | deploy user |
| `SSH_KEY` | private key for that user |
| `DEPLOY_PATH` | e.g. `/srv/revayat` |
| `NEXT_PUBLIC_SITE_URL` | `https://revayat.shop` |
| `NEXT_PUBLIC_ENAMAD_CODE` | optional |

Also add an environment named `production` (Settings → Environments) if you want
a manual approval gate before deploys.

## Data

Catalog, orders, payments, coupons, admins — everything transactional lives
in Postgres, in the `revayat_pgdata` Docker volume (`db` compose service).
Admin-uploaded product images live in the `revayat_uploads` volume
(`MEDIA_UPLOADS_DIR`, mounted into `web`). Nothing is baked into the image;
both volumes survive every deploy untouched — `deploy.sh` only replaces the
`web` container.

### Backup

Automatic: the `backup` compose service runs `pg_dump -Fc` on boot and then
every `BACKUP_INTERVAL_HOURS` (default 24), writing to the `revayat_backups`
volume and pruning dumps older than `BACKUP_RETENTION_DAYS` (default 14) —
see `pg-backup-entrypoint.sh`. No cron setup needed; it's a long-running
container.

Copy a dump off-box before trusting it as your only copy — a backup on the
same disk survives a bad deploy but not a dead VM:

```bash
docker compose cp backup:/backups/. ./backups-offbox/
```

Manual, one-off dump:

```bash
docker compose exec backup pg_dump -Fc -f /backups/manual-$(date -u +%Y%m%dT%H%M%SZ).dump
```

### Restore

Destructive — this replaces the live database. Confirm you're restoring the
right dump and that you intend to discard any writes made after it, before
running this on a host serving real traffic.

```bash
docker compose stop web                     # stop writes first
docker compose exec -T db pg_restore --clean --if-exists \
  -U "$POSTGRES_USER" -d "$POSTGRES_DB" < /path/to/revayat-<timestamp>.dump
docker compose start web
```

There is no automated down-migration path — Drizzle only applies forward
migrations. Reverting a bad schema change means restoring the most recent
pre-change `pg_dump`, which loses any data written after that dump.

## Where secrets live

| Secret | Lives in | Never in |
|---|---|---|
| `ADMIN_SESSION_SECRET` | server `.env`, laptop `.env.local` | Git — `.gitignore` blocks `.env`/`.env.local` |
| `POSTGRES_PASSWORD` | server `.env` | Git |
| `ZIBAL_MERCHANT` | server `.env`, laptop `.env.local` | Git, **and the browser** — never rename it `NEXT_PUBLIC_*` |
| `SSH_KEY`, `SSH_HOST` | GitHub Actions secrets | the repo |
| GHCR token | `docker login` on the server | the repo |

`.env.example` lists every variable with placeholder values and **is** committed;
`.env` holds the real ones and is not. `git check-ignore -v .env` confirms it.

### Rotating the admin session secret

```bash
openssl rand -base64 32            # on the server
$EDITOR /srv/revayat/.env          # set ADMIN_SESSION_SECRET
docker compose up -d --force-recreate web
```

Do the same in your laptop `.env.local`. Existing admin sessions are signed
with the secret, so they are invalidated by the change — log in again.
Admin *passwords* are per-account, hashed rows in the `admins` table (see
`apps/web/scripts/seed-admin.ts`, `/admin/team`) — nothing to rotate here for
those; reset one from **مدیریت → تیم** instead.

## Payments (Zibal)

Checkout redirects to Zibal, and the order is only completed after the payment
is verified **server-side**. The flow:

1. `/checkout` → `POST /v1/request` → a `trackId`, and a `pending` row in
   `payments.json` written *before* the customer leaves.
2. Browser goes to `https://gateway.zibal.ir/start/<trackId>`.
3. The bank returns the customer to `/payment/callback`.
4. That route calls `POST /v1/verify` and only then marks the order paid.

The callback's `success=1` is **never trusted** — it is a plain GET on a public
URL that anyone can type. `/v1/verify` is the only thing that completes an
order, and the amount it reports is checked against the stored order total
before anything is marked paid.

### Configuring the merchant

`ZIBAL_MERCHANT` must be set on the server, in `.env`. `deploy.sh` refuses to
deploy without it, because a site that silently cannot take payments is worse
than a failed deploy.

```bash
$EDITOR /srv/revayat/.env          # set ZIBAL_MERCHANT=<merchant id>
./deploy.sh                        # redeploy the current pin
```

Set it to the literal `zibal` to run against Zibal's sandbox: the whole flow
works end to end and no real money moves. Useful on staging.

If the variable is missing the storefront still runs, but checkout shows a
"gateway not configured" error rather than accepting orders it cannot charge —
and `/admin/payments` shows a red banner saying so.

### HTTPS

`callbackUrl` is built from `X-Forwarded-Proto` and `X-Forwarded-Host`, both set
by nginx (see `nginx.conf`). If those headers are ever dropped, the callback URL
falls back to `NEXT_PUBLIC_SITE_URL`. Zibal rejects a non-absolute callback with
result 106.

The CSP in `next.config.mjs` lists `https://gateway.zibal.ir` in `form-action`.
Without it the browser blocks the redirect to the bank and the customer never
reaches the payment page. It is a navigation target only — no Zibal script,
style, frame or XHR is permitted.

### Diagnosing a dead checkout

Two configuration faults produce a checkout that looks broken to customers.
Both are now loud in `docker compose logs web`:

| Symptom | Log line | Fix |
|---|---|---|
| "درگاه پرداخت پیکربندی نشده است" | `CONFIGURATION ERROR: ZIBAL_MERCHANT is not set` | Set `ZIBAL_MERCHANT` in the server `.env`, then `docker compose up -d --force-recreate web` |
| "آدرس IP این سرور در پنل زیبال مجاز نشده است" (result 115) | `CONFIGURATION ERROR on /v1/request: result=115 "invalid IP <addr>"` | Add that IP to the merchant's allowlist in the Zibal panel |

Zibal's `115` response names the rejected address, and the log line quotes it —
that is the address to allowlist. Note it is the **server's** egress IP, not
your laptop's: testing the production merchant from a workstation will return
115 even when production is configured correctly.

The container also prints a warning at boot when `ZIBAL_MERCHANT` is missing,
and `deploy.sh` refuses to deploy without it, so this should not reach
production again.

### When a payment gets stuck

A customer who closes the tab on the bank page leaves a `pending` row and no
callback. Open **مدیریت → پرداخت‌ها**, filter by "در انتظار", and press
**استعلام از درگاه**: that calls `POST /v1/inquiry` and, if the money really
moved, runs a real verify and completes the order.

Note that `/v1/inquiry` returns `result: 100` for any *successful lookup*,
whatever the payment did — the payment's actual state is in `status`. The two
responses are interpreted by different functions (`decideInquiry` vs
`decideVerification` in `src/lib/zibal-codes.ts`) for exactly this reason.

### Testing the integration

```bash
cd apps/web && npm test          # 74 tests, no network
```

Covers success, failure, cancellation, duplicate and concurrent callbacks,
already-verified transactions, amount tampering, forged callbacks, and inquiry.

## Analytics cookies

Three first-party cookies. The two analytics ones hold only a random opaque id —
not derived from the IP, the user agent, or anything the visitor typed:

| Cookie | Life | Set by | Purpose |
|---|---|---|---|
| `_rs` | 30 min, sliding | `/api/track` | one session; the idle timeout *is* the expiry |
| `_rv` | 180 days | `/api/track` | new vs returning visitor |
| `_rc` | 180 days | `/api/consent` | the banner answer, literally `yes` or `no` |

`_rs`/`_rv` are `HttpOnly`; `_rc` is not, because the banner has to decide
whether to render without a server round-trip. All are `SameSite=Lax` and
`Secure` whenever the request arrives over HTTPS. No third-party origins, so the
CSP is unchanged.

**Nothing is tracked until the visitor accepts.** `_rs`/`_rv` are only ever
issued to someone holding `_rc=yes`; `/api/track` returns `204` and sets no
cookie otherwise, and the client does not even send the request. Declining
deletes any ids from a previous acceptance.

Consequences worth knowing when reading the dashboard:

- Every traffic number is a **floor** — it counts consented visitors only.
- `cart→order` counts only orders from consented buyers, because `add_to_cart`
  only exists for them. Without that the rate would exceed 100%. The flag is one
  bit on the purchase row (`consented`), never an identifier.
- The consent tile counts **answers, not people**: a declined row deliberately
  carries no visitor id, so a change of mind counts twice. Repeat posts of an
  unchanged answer are deduped and never recorded.

If you change any lifetime in `src/lib/analytics.ts`, update the disclosure in
`src/lib/pages.ts` (`/pages/privacy`) to match — it names all three durations.

Visitors who accept but block cookies still get counted, via the daily-rotating
hash fallback; they can only ever look "new," so the returning figure is a floor.

## Product images

Uploads through the admin panel are capped at 5MB and served with a one-day
cache. The originals in `public/products/` were 77MB and are now 31MB:

```bash
cd apps/web
node scripts/compress-images.mjs            # dry run — prints every change
node scripts/compress-images.mjs --apply    # rewrite in place
```

It re-encodes each file to **the same path, name and format**, so `products.json`
and every rendered `src` keep working — the only difference is fewer bytes. It
caps the long edge at 2000px, skips anything that would grow, and writes via a
temp file + rename so an interrupted run cannot truncate an image. Run it after
adding photos to `public/products/`; admin uploads under `data/uploads/` are
covered too when `DATA_DIR` is set.

## Local development

```bash
cd apps/web && npm install && npm run dev      # hot reload, port 3000
```

Local secrets go in `apps/web/.env.local` (git-ignored, and **not** tracked —
if `git ls-files` ever lists it again, `git rm --cached` it, because
`.gitignore` does not apply to files already tracked):

```
DATABASE_URL=postgresql://revayat:revayat@localhost:5432/revayat
ADMIN_SESSION_SECRET=<anything>
ZIBAL_MERCHANT=zibal          # sandbox: full flow, no real money
```

To exercise the production stack locally, `docker compose up --build` —
`docker-compose.override.yml` makes Compose build from source instead of pulling
from GHCR. That file must not exist on the server (`deploy.sh` passes
`-f docker-compose.yml` explicitly, so it is ignored there regardless).
