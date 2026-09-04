# Phase 8 — Cutover Checklist

Preparation only. Nothing in this document has been executed against
production. No merge to `main`, no production deploy, no destructive
operation was run while producing it. See `DEPLOY.md` for the full deploy/
rollback/backup runbook this checklist points into.

## 1. Deployment readiness

Reviewed (not modified — all already correct for the current Postgres+Drizzle
architecture):

| Component | Status | Notes |
|---|---|---|
| `apps/web/Dockerfile` | OK | 3-stage build, non-root runner, standalone Next.js output, EXPOSE 3000 |
| `docker-compose.yml` | OK | `db` → `web` startup order via `depends_on: condition: service_healthy`; `nginx`/`certbot` depend on `web` |
| `nginx.conf` | OK | HTTP→HTTPS redirect, ACME webroot excluded, HSTS, forwards `X-Forwarded-Proto` (required for secure cookies) |
| `deploy.sh` | OK | Refuses to deploy without `ZIBAL_MERCHANT`; polls container healthcheck; auto-reverts on unhealthy |
| `rollback.sh` | OK | Retag + restart to `.deploy-image.prev`, no rebuild, data untouched |
| Restart policies | OK | All compose services `restart: unless-stopped` |
| Persistent volumes | OK | `revayat_pgdata` (DB), `revayat_uploads` (media), `revayat_backups` (dumps), `certbot_conf`/`certbot_www` — none baked into the image, all survive a deploy |
| Health checks | OK | `db`: `pg_isready`; `web`: `fetch('/')` from inside the container, 20s start period |
| Logging | Container stdout/stderr only (`docker compose logs`) — no shipping to an external aggregator configured. Acceptable for current scale; flag if log retention/search becomes a requirement | 

**Gap found and fixed this phase**: `DEPLOY.md` described the pre-Postgres
JSON-file data model (`ADMIN_PASSWORD`, `revayat_data` volume, tar-based
backup) — stale since the Drizzle/Postgres migration. Corrected: env var
table, Data/Backup/Restore sections, secrets table, admin-secret rotation.

## 2. Database migration order

1. `docker compose up -d db` — Postgres starts, `pg_isready` healthcheck gates step 2.
2. `docker compose up -d web` — entrypoint runs `node scripts/migrate.mjs`
   (Drizzle forward migrations, tracked in `__drizzle_migrations`, idempotent
   — safe to run on every boot, including redeploys with no new migrations).
   Current migrations: `0000_free_speed.sql` (initial schema), `0001_fair_cerise.sql`
   (admin roles editor/support, `inventory_adjustments`, `admins.active`,
   `categories.active`, `coupons.assigned_phone`).
3. One-time, only on a fresh production DB, **after** step 2 has created the
   schema: `npm run migrate:legacy-json` (see `DEPLOY.md` → "Database
   migrations and first-time catalog import" for the exact run pattern — the
   production image doesn't ship this script's source, so it runs from the
   full repo checkout against the `db` service).
4. One-time, only if the `admins` table is empty: `npm run db:seed-admin`.
5. `docker compose up -d` (remaining services: `backup`, `nginx`, `certbot`).

Confirmed:
- **No destructive schema push.** Every migration file is additive (new
  enums/values, new tables, new nullable-by-default columns) — no `DROP`,
  no `ALTER ... NOT NULL` without a default, confirmed by reading both `.sql`
  files.
- **Repeatable.** Drizzle's migration tracking table makes re-running the
  entrypoint a no-op once applied. `migrate-legacy-json.ts` is upsert-on-slug
  for categories and existence-check-then-skip for products — reruns don't
  duplicate rows, though they also won't update an already-migrated
  product's data if the source JSON changed after the first run.
- **No down-migration path exists.** Confirmed via `apps/web/src/db/migrations/`
  and `package.json` — only `db:generate`/`db:migrate` (forward). Rollback of
  a bad schema change means restoring the last pre-change `pg_dump` (see §7),
  which loses writes made after that dump. Flagged in `DEPLOY.md` → Restore.

## 3. Environment variables

| Variable | Required | Purpose | Verified |
|---|---|---|---|
| `DATABASE_URL` | yes (app) | Postgres connection; built automatically inside `docker-compose.yml` from `POSTGRES_*` for the `web` service | `drizzle.config.ts` throws if unset — fail-fast confirmed by reading the file |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | yes | Provisions `db` service | `docker-compose.yml` |
| `ADMIN_SESSION_SECRET` | yes | Signs admin session tokens | used in `lib/admin/session.ts` per `.env.local` example comment |
| `ZIBAL_MERCHANT` | yes for checkout | Payment gateway merchant id — `deploy.sh` hard-refuses deploy without it | confirmed in `deploy.sh:21-24` |
| `NEXT_PUBLIC_SITE_URL` | yes | Canonical origin — feeds sitemap, robots, canonical URLs, Zibal callback fallback | see §4 |
| `NEXT_PUBLIC_ENAMAD_CODE` | no | Optional trust-seal embed | — |
| `MEDIA_UPLOADS_DIR` | no (defaults `/app/uploads` in image) | Local-disk media storage path — must be volume-backed (`revayat_uploads`) | `docker-compose.yml`, `Dockerfile:48` |
| `BACKUP_RETENTION_DAYS` | no (default 14) | Pruning window for scheduled `pg_dump` | `pg-backup-entrypoint.sh` |
| `CERT_DOMAIN` | no (default `revayat.shop`) | Certbot cert domain | `docker-compose.yml` |

**Cookie/security settings**: `_rs`/`_rv` `HttpOnly`, all three analytics
cookies `SameSite=Lax` + `Secure` whenever the request arrives over HTTPS
(driven by `X-Forwarded-Proto`, set by `nginx.conf:41` — confirmed present).
Admin session cookie follows the same `secure`-flag pattern per `DEPLOY.md`.

**Secrets audit** (git history + current tree):
- Current tracked tree: clean. Manual `git grep` for
  `ZIBAL_MERCHANT=`/`ADMIN_SESSION_SECRET=`/`POSTGRES_PASSWORD=`/`DATABASE_URL=`
  outside `.env.example`/docs found only the intentional fake build-time
  placeholder in `Dockerfile:19` (`postgresql://build:build@localhost:5432/build`,
  never reachable, build-only). **Phase 8.1**: re-verified with a tool-based scan
  (`gitleaks detect --no-git` against a clean `git archive HEAD` export, so
  build artifacts / `.next/` can't produce false positives) — 0 findings.
- Git history: `.env` and `apps/web/.env.local` **were** committed in the
  repo's first two commits (`401560b`, `cb10f00`, 2026-08-15) before
  `.gitignore` picked them up — not rewritten (private repo, already a
  known/accepted tradeoff documented in `DEPLOY.md`'s admin-secret-rotation
  section).
- **New this phase**: the same commit `401560b` also added an RSA private key
  file, `ar-mehdi-privatekey.pem` — missed by the manual grep (it only checked
  known env-var patterns, not arbitrary filenames), caught by `gitleaks`'
  full-history scan (`private-key` rule, `401560baeaf240868e99adc3138d31f1faa9fff5:ar-mehdi-privatekey.pem:1`).
  Not present in the current tracked tree (`*.pem` is gitignored — confirmed
  via `git ls-files`), but still recoverable from history like the `.env`
  files. **This needs its own rotation action, not just a value swap**: if this
  key was ever installed anywhere (server `authorized_keys`, a deploy key, a
  TLS cert) it must be **revoked/removed from every server and service it was
  added to**, and a new keypair issued — regenerating a password isn't
  sufficient for a private key the way it is for `POSTGRES_PASSWORD`.

**Secret classes to rotate before go-live** (every value that ever appeared in
commit `401560b`/`cb10f00` is burned):
| Secret | Action |
|---|---|
| `POSTGRES_PASSWORD` | Generate fresh, set in production `.env` only |
| `ADMIN_SESSION_SECRET` | Generate fresh — invalidates all existing admin sessions on rotation (expected) |
| `ZIBAL_MERCHANT` | Use the real merchant id (never the `zibal` sandbox literal) in production, sourced fresh from the Zibal dashboard |
| `ar-mehdi-privatekey.pem` | Revoke/remove from every server or service it was ever added to; issue a new keypair — see above |
| Seeded admin password (`npm run db:seed-admin`'s default) | Force a real password reset immediately after first production login, before any other admin work |

**Deployment env update procedure per secret class (Phase 8.2)** — how each
rotated value actually reaches the running production deployment, not just
what to generate. No values below; commands only.

| Secret | Update procedure | Restart scope |
|---|---|---|
| `ADMIN_SESSION_SECRET` | `openssl rand -base64 32` on the server → `$EDITOR /srv/revayat/.env` → set var. Documented in `DEPLOY.md` "Rotating the admin session secret". | `docker compose up -d --force-recreate web`. All existing admin sessions invalidated (expected) — every admin must log in again. |
| `ZIBAL_MERCHANT` | Get real merchant id from the Zibal dashboard → `$EDITOR /srv/revayat/.env` → set var. Documented in `DEPLOY.md` "Configuring the merchant". | `./deploy.sh` (redeploys current image pin, which reads the new `.env` value at container start). |
| `POSTGRES_PASSWORD` | Generate fresh value → `$EDITOR /srv/revayat/.env` → set var **and** apply it inside the running DB first (`docker compose exec db psql -U <user> -c "ALTER USER <user> WITH PASSWORD '<new>';"`) so the old value stops working atomically with the `.env` change — not documented in `DEPLOY.md` yet, add before go-live. | `docker compose up -d --force-recreate db web` (both — `web`'s `DATABASE_URL` is built from this var at container start, per §3 table above). Expect a brief connection gap while `db` restarts. |
| `ar-mehdi-privatekey.pem` | Not an env var — a file. Revoke/remove from every server (`authorized_keys`), service, or TLS config it was ever installed to; issue and install a fresh keypair in its place. No `.env` entry exists for this — it was never meant to be in the repo at all (see §3 audit above). | Per-service — SSH `authorized_keys` takes effect immediately on removal; any TLS/cert usage needs a reload of the consuming service. |
| Seeded admin password (`npm run db:seed-admin` default) | Log in once with the seeded credentials, then reset immediately via **مدیریت → تیم** (per-account hashed row in `admins`, not an env var — see `DEPLOY.md` "Rotating the admin session secret"). | None — takes effect on next login attempt, no container restart needed. |


- CI: `.github/workflows/deploy.yml` `build` job now runs
  [`gitleaks/gitleaks-action@v2`](https://github.com/gitleaks/gitleaks-action)
  (checkout widened to `fetch-depth: 0` so it can see full history) — fails the
  build on any detected secret, before install/typecheck/test even run.
- Local, no-install-needed equivalent (Docker, already available):
  `docker run --rm -v "$PWD:/repo" zricethezav/gitleaks:latest detect --source /repo -v --no-git`
  for the tracked tree, or point `--source` at a `git archive HEAD` export for
  a false-positive-free scan that ignores `.next`/build output.

## 4. SEO continuity

Site identity: روایت شاپ / Revayat Shop — `https://revayat.shop/`.

| Check | Status | Notes |
|---|---|---|
| URL structure | **Unchanged** | Flat paths confirmed: `/products/{slug}`, `/collections/{slug}`, `/support/{slug}` — no locale/category prefix, no redirects/rewrites in `next.config.mjs` |
| Sitemap | Present, mostly complete | `src/app/sitemap.ts`: home, `/collections`, `/search`, `/about`, every category, every product. **Gap**: `/faq` and every `/support/{slug}` are not listed. |
| robots.txt | OK | `allow: /`, `disallow: /admin, /api/, /cart, /checkout`, sitemap + host declared |
| Canonical URLs | Present on main commerce routes | Home (layout default `/`), `/products/[slug]`, `/collections/[slug]`, `/search` all set `alternates.canonical`. **Gap**: `/faq`, `/support/[slug]` have no page-level metadata at all — inherit the generic layout title, no canonical. |
| Organization + WebSite JSON-LD | OK, sitewide | `src/lib/seo/json-ld.ts`, injected in root layout on every page |
| Product JSON-LD | OK | `/products/[slug]` |
| BreadcrumbList JSON-LD | OK | `/products/[slug]`, `/collections/[slug]` |
| Keyword stuffing | None found | Metadata reviewed reads as descriptive product/category copy, not repeated keyword strings |

**Not fixed this phase** (explicitly out of scope — "no application
architecture changes" carried over from Phase 7.6, and the user's Phase 8
brief asked to *verify* continuity, not remediate): the `/faq`/`/support`
metadata and sitemap gaps, and a separate, unrelated finding —
`getProduct`/`getProducts`/`getProductRecommendations` in
`src/lib/commerce/products.ts` are wrapped in `unstable_cache(..., {tags:
['products']})` with zero `revalidateTag('products')` call sites anywhere in
`src` — the cache is effectively permanent for a running server process.
Recommend a follow-up ticket for both before/shortly after go-live; neither
blocks cutover (old indexed routes are unaffected either way).

## 5. Final functional smoke test checklist

Manual checklist for a human to run against the real deploy before opening
DNS to the public, plus `smoke-test.sh` (repo root) for the subset that's a
plain HTTP GET (run it with `BASE_URL=https://revayat.shop ./smoke-test.sh`
once DNS/TLS are live — never against `.shop` before that).

**Storefront**
- [ ] Homepage loads, hero/announcement render
- [ ] `/collections` lists categories; a category page lists its products
- [ ] Product page renders images, price, variant selector
- [ ] Selecting an out-of-stock variant disables "افزودن به سبد"
- [ ] `/search` returns results for a known product term

**Commerce**
- [ ] Add to cart, update quantity, remove from cart
- [ ] Checkout: shipping form validates phone/address
- [ ] Coupon applies and adjusts total
- [ ] Placing an order creates an `inventory_reservations` row (`reserved`)
- [ ] Successful payment confirms the reservation and clears the cart

**Payments (Zibal, sandbox merchant — never spam the real merchant)**
- [ ] `/v1/request` returns a `trackId`, browser reaches `gateway.zibal.ir`
- [ ] Callback with `success=1` marks the order paid, reservation `confirmed`
- [ ] Failed outcome releases the reservation, order stays unpaid, retry works
- [ ] Replaying the same callback does not double-settle
- [ ] Tampered stored amount is rejected at verify, order stays unpaid

**Admin**
- [ ] Login works; wrong password rejected without account enumeration
- [ ] Role restrictions hold (editor/support cannot reach owner-only pages)
- [ ] Products: create/edit/deactivate
- [ ] Categories: create/edit
- [ ] Inventory: stock adjustment reflected in storefront availability
- [ ] Orders: status transition reflected on the order detail page
- [ ] Coupons: create, usage count increments on a real order
- [ ] Settings: hero/announcement edit reflects on storefront without a redeploy

This list mirrors `apps/web/e2e/*.spec.ts`, which already automates most of
it against a local build (see §8) — this checklist is the "run it again,
by hand, against the real deploy" pass those specs can't do for you.

## 6. Load testing

See `docs/LOAD-TESTING.md` — executed for real in Phase 8.1 against a
disposable staging stack (Artillery storefront pass: 0 failures, p95 6ms;
`auth-stress.spec.ts`: 4/4 pass; `commerce-concurrency.spec.ts`: invariants
clean, one non-blocking `unstable_cache` finding — see §4). `payment-
callback.yml` still not run (real Zibal sandbox calls, capped by design —
run separately on request). See §9's LOAD TEST column.

## 7. Backup and recovery readiness

- **Backup**: automated, already running whenever the `backup` compose
  service is up — `pg_dump -Fc` on boot + every `BACKUP_INTERVAL_HOURS`
  (default 24h), retained `BACKUP_RETENTION_DAYS` (default 14), written to
  the `revayat_backups` volume (`pg-backup-entrypoint.sh`).
- **Restore procedure**: documented in `DEPLOY.md` → "Restore"
  (`pg_restore --clean --if-exists` after `docker compose stop web`).
- **Restore tested**: **YES — Phase 8.1.** Real cycle executed against a
  disposable Postgres container (`revayat-staging-db`, `postgres:16-alpine`,
  its own volume, port 5433 — never the shared dev DB, never production):
  1. `docker compose exec -T db pg_dump -Fc -U revayat revayat > backup-test.dump`
     — 77,116 bytes, clean exit, empty stderr.
  2. Pre-dump baseline: exact `count(*)` per table against the dev DB.
  3. `docker cp backup-test.dump revayat-staging-db:/tmp/` then
     `pg_restore --clean --if-exists -U revayat -d revayat_staging /tmp/backup-test.dump`
     — verbose rerun confirmed all 15 foreign-key constraints recreated.
  4. Post-restore row counts matched the pre-dump baseline **exactly** across
     every table checked: `admin_sessions`, `admins`, `cart_items`, `carts`,
     `categories`, `coupons`, `customers`, `order_items`, `orders`,
     `product_variants`, `products`, `rate_limits` — plus Drizzle's own
     migration-tracking table, `drizzle.__drizzle_migrations` (2 rows, both
     sides — note this table lives in the `drizzle` schema, not `public`).
  5. Staging container + volume torn down after use (reused for §6 load
     testing first — see below — then removed).
  No data loss, no corruption, no missing FK, no missing migration record.
  Backup path is verified end-to-end.

## 8. RBAC browser-level coverage — Phase 8.1 §4, fixed Phase 8.2 §1

**Status-code gap closed, Phase 8.2**: `src/proxy.ts` (Next 16 Proxy, `matcher:
'/admin/:path*'`) now runs the same session+permission check as
`requireAdmin()`/`requirePermission()` — a real DB session lookup via
`getSessionByToken` (exported from `lib/admin/session.ts`, shared with the
page-level check, not duplicated logic) and a route→permission map
(`permissionForPath` in `lib/admin/rbac.ts`) — before any route starts
streaming, and returns a real `404` via `NextResponse.rewrite` to a
non-existent path. `/admin/login` and `/admin/logout` stay public. Page-level
`requireAdmin()`/`requirePermission()` calls are untouched — this is additive
defense-in-depth, not a replacement; server-side authorization is unchanged
per the Phase 8.2 requirement. `rbac.spec.ts` (unchanged since Phase 8.1,
asserting real `404` throughout): **5/5 pass**, up from 1/5. Verified via
`npm run typecheck`, `npm run build` (proxy compiles and bundles its
`'server-only'`-tagged DB import correctly), and two consecutive full
`npx playwright test` runs (26/26 both times).

New file `apps/web/e2e/rbac.spec.ts`, 5 tests, self-contained fixture admins
(`rbac-editor@`, `rbac-support@`, `rbac-disabled@revayat.test`), wired into
the normal e2e suite (not disposable load-test tooling — runs every time
`npm run test:e2e` does).

**Result: 1 passed, 4 failed.** This is a real application finding, not a
test bug — root-caused via direct HTTP response inspection (`response.text()`,
bypassing the browser's rendered DOM to see exactly what the server sent):

- **No data leak.** In every failing case the response body correctly
  contains the `not-found.tsx` content (`این صفحه پیدا نشد`) and *not* the
  real page — confirmed by grepping the raw response for both the not-found
  heading and a marker unique to the real page (e.g. the products/orders
  page's own `<h1>`). `requireAdmin()`/`requirePermission()` are correctly
  blocking every case tested: wrong role, disabled admin mid-session,
  revoked session mid-use.
- **The bug is the HTTP status code.** The response is `200`, not `404`,
  despite rendering not-found content. Root cause, confirmed against Next.js
  16's own documentation (`node_modules/next/dist/docs/.../not-found.md`,
  "Calling notFound() after streaming has started"): once a route's outer
  segments (root layout → admin `(protected)` layout) have resolved and the
  response has begun streaming, the status code is already committed as
  `200` — a `notFound()` thrown later, from the page itself, still swaps in
  the not-found UI but can no longer change the status. This app's root
  layout (`src/app/layout.tsx`) does async work (`getSiteSettings`,
  `listSupportPages`) ahead of the admin layout's `requireAdmin()` and the
  page's `requirePermission()`, which is enough to trigger this even with no
  `<Suspense>` boundary anywhere in the admin route tree.
- **This is a real, if narrow, regression against the stated design goal.**
  `(protected)/layout.tsx` deliberately uses `notFound()` instead of a
  redirect specifically "so a redirect can't hint `/admin/...` exists"
  (anti-enumeration). That property holds for page *content*. It does not
  hold for the status code: a client checking status alone (not rendered
  content) can currently distinguish "session/permission rejected" (`200`)
  from "truly no such route" (also whatever a random 404'd path returns —
  itself `200` under this same mechanism, so in practice this mostly
  self-cancels for a pure status-code enumeration attempt, but it is not the
  intended, documented behavior and should not be relied on).
- **Confirmed reproducing this Next.js version's documented streaming
  behavior**, not a one-off flake: reproduced identically across 4 distinct
  trigger paths (missing permission on two different roles, admin disabled
  mid-session, session revoked mid-use), each via fresh diagnostic
  instrumentation, each reverted after confirming.
- **Not fixed in Phase 8.1** — was scoped as "test tooling only, no
  application architecture changes" for that phase; the recommended fix
  (moving the check into `proxy`) was a genuine architecture change, sized
  for its own reviewed phase.
- **Fixed Phase 8.2 §1** — see the status box above this section. The gate
  now runs in `src/proxy.ts`, ahead of streaming, so the status code matches
  the anti-enumeration design intent in all 5 tested cases.

Test file left exactly as originally designed — asserting the real `404`
status the anti-enumeration design intends. It now passes 5/5 (Phase 8.2),
having correctly documented the gap on every run beforehand instead of
hiding it.

## 9. Final verification matrix

Legend: **VERIFIED** = evidence from an actual run this session or a prior
completed phase · **NOT RUN** = prepared but not executed · **N/A** = doesn't
apply to that layer.

| Area | Unit | DB | Browser (e2e) | Zibal sandbox | Load test |
|---|---|---|---|---|---|
| Storefront (home/collections/product) | VERIFIED | VERIFIED (live queries in e2e) | VERIFIED (`storefront.spec.ts`) | N/A | VERIFIED (`storefront.yml`, §6.1: 0 failures, p95 6ms) |
| Search | VERIFIED | VERIFIED | VERIFIED | N/A | VERIFIED (covered by `storefront.yml`) |
| Variants | VERIFIED | VERIFIED | VERIFIED | N/A | NOT RUN |
| Cart | VERIFIED | VERIFIED | VERIFIED (`cart.spec.ts`) | N/A | NOT RUN |
| Checkout | VERIFIED | VERIFIED | VERIFIED (`checkout.spec.ts`) | N/A | VERIFIED (invariants clean, §6.2/6.3; `unstable_cache` stale-render gap found this pass **resolved Phase 8.2 §3** — see §10 item 5) |
| Inventory / reservations | VERIFIED | VERIFIED | VERIFIED | N/A | VERIFIED (`commerce-concurrency.spec.ts`, `verify-invariants.mjs` clean under 12-buyer race for 5 units — no oversell) |
| Coupons | VERIFIED | VERIFIED | VERIFIED | N/A | VERIFIED (same run, no `max_uses_total` overage) |
| Orders | VERIFIED | VERIFIED | VERIFIED | N/A | NOT RUN |
| Payments | VERIFIED (74 payment-flow unit tests per `DEPLOY.md`) | VERIFIED | VERIFIED (`payment.spec.ts`, 4 tests × 2 consecutive clean runs) | VERIFIED (real hosted sandbox, this suite) | NOT RUN (`payment-callback.yml` skipped this pass, capped by design — see §6.5) |
| Admin | VERIFIED | VERIFIED | VERIFIED (`admin.spec.ts`) | N/A | VERIFIED (`auth-stress.spec.ts`, §6.4: 4/4 pass) |
| Uploads | VERIFIED | N/A | Not covered by current e2e specs — add before go-live if uploads changed recently | N/A | NOT RUN |
| SEO | N/A | N/A | Manually reviewed §4 this phase, not automated | N/A | N/A |
| Security (rate limiting, RBAC, session) | VERIFIED (`rate-limit` tests, `src/lib/admin/rbac.test.ts`) | VERIFIED | **VERIFIED (Phase 8.2)** — `rbac.spec.ts` 5/5 pass: both content-blocking and HTTP status (`404`, via `src/proxy.ts`) confirmed — see §8 | N/A | VERIFIED (auth stress, §6.4 — rate limit/lockout/enumeration-resistance) |
| Backups | N/A | Automated dump confirmed running | N/A | N/A | VERIFIED — **restore tested, Phase 8.1, see §7** |

## 10. Remaining blockers before go-live

1. ~~Backup restore has never been exercised.~~ **Resolved, Phase 8.1** —
   real `pg_dump`/`pg_restore` cycle executed against a disposable staging
   Postgres, row counts matched exactly across every table, see §7.
2. ~~Load testing not executed.~~ **Resolved, Phase 8.1** — Artillery +
   Playwright scenarios executed against a disposable staging stack, see
   §6/§9. `payment-callback.yml` still not run by design (§6.5) — not a
   blocker, can be run separately on request.
3. ~~RBAC status-code gap.~~ **Resolved, Phase 8.2 §1** — `src/proxy.ts` now
   gates every `/admin/*` request with a real 404, ahead of streaming. See §8.
4. **No down-migration path** — accepted as-is (industry-normal for Drizzle),
   but the *first* real production schema change should be rehearsed
   restore-from-backup once, per item 1, before it's needed for real.
5. ~~Permanent `unstable_cache` on product queries.~~ **Resolved, Phase 8.2
   §3** — reservation-lifecycle writes (`createOrder`, `ensureHold`, and the
   failure/cancel branch of `applyDecision`) now call
   `revalidateTag('products', {expire: 0})` immediately after their owning
   transaction commits, so checkout/payment state changes are never served
   stale. `unstable_cache`'s three `products.ts` entries also gained a
   `revalidate: 30` TTL backstop, covering the one writer that cannot call
   any Next invalidation API (`scripts/release-expired-reservations.ts`,
   a standalone process outside Next's request scope). Admin-driven price
   and stock edits were already correctly invalidated pre-Phase-8.2 via
   `updateTag('products')` in `lib/admin/products.ts`/`lib/admin/inventory.ts`
   — unchanged. Remaining known non-blocking gap: stale `/faq`/`/support` SEO
   metadata (§4) — recommend a follow-up ticket, not a go-live blocker.
6. Every secret that ever touched the two 2026-08-15 commits (§3) should be
   rotated to a fresh value before the production `.env` is written — including
   the `ar-mehdi-privatekey.pem` private key found in `401560b` by this phase's
   gitleaks scan (revoke/reissue, not just a value swap). Phase 8.2 §2 added
   the per-secret deployment update procedure (commands + restart scope) —
   see §3.

All items above are now operational/verification only — no known application
code changes remain outstanding from Phases 8.1–8.2.

## 11. Phase 9 — Production cutover preparation

Preparation only, per this phase's explicit brief: no merge to `main`, no
automatic deploy, no production contact. Every action below ran against
disposable local Docker resources (image tag `revayat-web:phase9-verify`, a
throwaway `postgres:16-alpine` container, an isolated bridge network) — all
removed after use, confirmed via `docker ps -a`/`docker network ls`/`docker
rmi` post-teardown.

**1. Final migration checklist** — unchanged since §2/§7.1: two files,
`0000_free_speed.sql` (initial schema) and `0001_fair_cerise.sql` (roles,
`inventory_adjustments`, three nullable/defaulted columns). Re-swept both this
phase with a targeted grep for `ALTER`/`DROP`/`TRUNCATE` — every hit is either
an `ADD CONSTRAINT ... FOREIGN KEY`, an `ALTER TYPE ... ADD VALUE`, or an `ADD
COLUMN` with a default; zero `DROP`, zero `NOT NULL` without a default.
`meta/_journal.json` confirms strict order (`idx 0` → `0000_free_speed`, `idx
1` → `0001_fair_cerise`). No new migrations exist since Phase 8.

**2. Production environment validation** — cross-checked `.env.example`
against `docker-compose.yml`'s consumed vars and `deploy.sh`'s enforced
checks. All seven vars (`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_ENAMAD_CODE`,
`POSTGRES_USER`/`PASSWORD`/`DB`, `ADMIN_SESSION_SECRET`, `ZIBAL_MERCHANT`,
`BACKUP_RETENTION_DAYS`) are consumed somewhere in the compose file or app.
**Gap found**: `deploy.sh` hard-refuses a deploy with a missing/empty
`ZIBAL_MERCHANT`, but enforces nothing on `ADMIN_SESSION_SECRET` or
`POSTGRES_PASSWORD` still holding the literal `change-me` placeholder from
`.env.example` — nothing technical stops a first deploy with default secrets.
Not a code blocker (this is an ops-discipline gap, not a bug), but the manual
cutover commands below include an explicit pre-flight grep for `change-me` in
`.env` to close it procedurally.

**3. Docker image build verification — executed.** `docker build -f
apps/web/Dockerfile --build-arg NEXT_PUBLIC_SITE_URL=https://revayat.shop
apps/web` succeeded (292MB image, non-root `nextjs` user confirmed via
`docker inspect`, `CMD ["node","server.js"]`). **Finding**: building *without*
`--build-arg NEXT_PUBLIC_SITE_URL=...` fails — `Error: Failed to collect page
data for /admin/admins`, root cause `new URL('')` in `src/app/layout.tsx:14`
(`metadataBase: new URL(site.url)`), because `src/lib/site.ts` reads
`NEXT_PUBLIC_SITE_URL` with no fallback. **Not a blocker**: `.github/workflows/deploy.yml:74`
already passes this build-arg from a GitHub secret on every CI build, so the
real deploy path is unaffected. Documented here because it means the
Dockerfile cannot be built standalone (e.g. by a human running `docker build`
directly on the server, bypassing CI) without remembering this flag —
consider adding a fallback default in `site.ts` as a low-priority follow-up,
or a comment in the Dockerfile next to the `ARG NEXT_PUBLIC_SITE_URL` line.
Booted the built image against a disposable Postgres on an isolated network:
entrypoint ran migrations (`[migrate] up to date`), logged the expected
sandbox-merchant notice, and served `GET /` → `200` within the healthcheck
window.

**4. Nginx/SSL checklist** — `nginx.conf`/`certbot-entrypoint.sh` reviewed
(Phase 8, unchanged). Prerequisites before the manual first-certificate step
in `DEPLOY.md`:
- [ ] DNS `A`/`AAAA` records for `revayat.shop` and `www.revayat.shop` point
      at the server's public IP (certbot's webroot challenge fails otherwise)
- [ ] Port 80 and 443 reachable from the internet (firewall/security group)
- [ ] `docker compose up -d` already running (nginx must be up to serve the
      ACME webroot challenge before certbot can issue)
- [ ] Real email for `-m` in the certbot command (renewal/expiry notices)
- [ ] `CERT_DOMAIN` in `.env` matches the actual domain if not `revayat.shop`

**5. Database migration plan** — unchanged from §2, re-verified this phase
(see item 1). Order: `db` up healthy → `web` up (runs migrations
automatically, idempotent) → one-time `migrate:legacy-json` only on a
brand-new DB → one-time `db:seed-admin` only if `admins` is empty → remaining
services up.

**6. Rollback procedure — read-traced and partially rehearsed.**
`deploy.sh`/`rollback.sh` logic re-read line by line this phase: pull → pin
`.deploy-image` → `up -d --no-deps web` → poll `docker inspect
.State.Health.Status` up to 60s → on anything but `healthy`, retag to the
prior pinned image and restart, exit 1 → only on success does `.deploy-image.prev`
get written. The container-healthcheck-gate half of this mechanism was
exercised for real in item 3's disposable run above (image reached `healthy`
serving state from a cold migration). **Not rehearsed this phase**: the
scripts themselves were not executed against a full multi-container compose
stack (`db`+`web`+`nginx`+`certbot`+`backup` together) — that needs a
production-shaped `.env`, which is out of scope for a preparation-only phase
with no server access. Recommend one full dry run of `./deploy.sh` +
`./rollback.sh` against the real compose stack on the server itself, on the
very first cutover, before DNS is pointed at it (self-contained, no public
traffic at risk yet).

**7. Smoke test checklist** — `smoke-test.sh` reviewed: 7 unauthenticated GET
checks (`/`, `/collections`, `/search?q=test`, `/sitemap.xml`, `/robots.txt`,
`/admin/login`, `/cart`), all expect `200`. This is the automatable subset
only — §5's manual checklist (storefront, commerce, Zibal sandbox flow,
admin RBAC/CRUD) remains the authoritative full pass for a human to run
against the real deploy before opening DNS.

**8. Post-deploy monitoring checklist** (new) — what to watch in the hour
after a real cutover:
- [ ] `docker compose ps` — all services `healthy`/`running`, none
      restarting in a loop
- [ ] `docker compose logs -f web` — watch specifically for the two named
      failure signatures in `DEPLOY.md` ("Diagnosing a dead checkout"):
      `CONFIGURATION ERROR: ZIBAL_MERCHANT is not set` and `CONFIGURATION
      ERROR on /v1/request: result=115`
- [ ] `docker compose logs -f web | grep 'PAYMENT CONFIRMED WITHOUT'` — the
      oversell canary already logged by `payment-flow.ts`'s `applyDecision`
      (see that file) — any hit means a hold was swept before a late
      verification landed; investigate immediately, don't ignore
- [ ] `BASE_URL=https://revayat.shop ./smoke-test.sh` once DNS/TLS are live
- [ ] `docker compose exec db psql -U <user> -c "select count(*) from
      pg_stat_activity;"` — connection count sane, no runaway growth
- [ ] `/admin/payments` → فیلتر "در انتظار" — stuck-pending payments beyond a
      normal bank round trip; use "استعلام از درگاه" to reconcile
- [ ] First scheduled `backup` service dump actually lands in the
      `revayat_backups` volume (`docker compose logs backup`)
- [ ] Certbot renewal loop logs no errors (`docker compose logs certbot`)
- [ ] Disk usage on `revayat_pgdata`/`revayat_uploads`/`revayat_backups`
      volumes — no unexpected growth
