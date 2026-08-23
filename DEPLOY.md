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
| `ADMIN_PASSWORD` | long random string |
| `NEXT_PUBLIC_ENAMAD_CODE` | optional |
| `CERT_DOMAIN` | defaults to `revayat.shop` |

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

Everything mutable lives in the `revayat_data` Docker volume:

```
/app/data/products.json     catalog (admin-editable)
/app/data/settings.json     hero text, announcement, footer
/app/data/orders.json       orders (incl. payment state per order)
/app/data/payments.json     payment attempts — trackId, amount, bank refs
/app/data/counters.json     monotonic order-id counter (never goes down)
/app/data/uploads/          uploaded product images
```

Seed copies ship in the image at `/app/data-seed` and are copied across **only
when a file is missing** (`apps/web/docker-entrypoint.sh`). An existing file is
never overwritten, so deploying cannot clobber admin edits.

> This is why admin changes used to need a restart: the old Dockerfile copied
> seed data to `/app/data`, which the volume then mounted over. The image copy
> was shadowed and permanently stale while the app wrote to the volume.

### Backup

```bash
docker run --rm -v revayat_revayat_data:/data -v "$PWD":/backup alpine \
  tar czf /backup/revayat-data-$(date +%F).tar.gz -C /data .
```

Restore:

```bash
docker run --rm -v revayat_revayat_data:/data -v "$PWD":/backup alpine \
  tar xzf /backup/revayat-data-2026-08-18.tar.gz -C /data
docker compose restart web
```

Back up before any deploy that changes the shape of the JSON files.

Nightly, at 03:12 (`crontab -e` as the deploy user) — the odd minute keeps it off
the hour, and `find -delete` keeps 30 days:

```cron
12 3 * * * cd /srv/revayat && docker run --rm -v revayat_revayat_data:/data -v /srv/backups:/backup alpine tar czf /backup/revayat-data-$(date +\%F).tar.gz -C /data . && find /srv/backups -name 'revayat-data-*.tar.gz' -mtime +30 -delete
```

A backup on the same disk survives a bad deploy but not a dead VM. Copy
`/srv/backups` off-box (rsync/object storage) if the orders matter.

## Where secrets live

| Secret | Lives in | Never in |
|---|---|---|
| `ADMIN_PASSWORD` | server `.env`, laptop `.env` | Git — `.gitignore` blocks `.env` |
| `ZIBAL_MERCHANT` | server `.env`, laptop `.env.local` | Git, **and the browser** — never rename it `NEXT_PUBLIC_*` |
| `SSH_KEY`, `SSH_HOST` | GitHub Actions secrets | the repo |
| GHCR token | `docker login` on the server | the repo |

`.env.example` lists every variable with placeholder values and **is** committed;
`.env` holds the real ones and is not. `git check-ignore -v .env` confirms it.

### Rotating the admin password

The old password is in Git history. History is not being rewritten (private repo,
your call), so rotate the value instead — that makes the committed one worthless:

```bash
openssl rand -base64 24            # on the server
$EDITOR /srv/revayat/.env          # set ADMIN_PASSWORD
docker compose up -d --force-recreate web
```

Do the same in your laptop `.env`. Existing admin sessions are signed with the
password, so they are invalidated by the change — log in again.

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
ADMIN_PASSWORD=<anything>
ZIBAL_MERCHANT=zibal          # sandbox: full flow, no real money
```

To exercise the production stack locally, `docker compose up --build` —
`docker-compose.override.yml` makes Compose build from source instead of pulling
from GHCR. That file must not exist on the server (`deploy.sh` passes
`-f docker-compose.yml` explicitly, so it is ignored there regardless).
