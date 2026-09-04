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

**Secret-scanning check (new this phase)**: no scanning existed before. Added:
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

## 8. RBAC browser-level coverage — Phase 8.1 §4

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
- **Not fixed this phase** — same "test tooling only, no application
  architecture changes" boundary as the `unstable_cache` finding in §4.
  Next's own docs recommend performing this class of check in middleware
  (Next 16: `proxy`) instead of deep in a page component, since middleware
  runs before any response streaming begins and can set a real status code.
  That is a genuine architecture change (moving session/permission checks
  out of page components into `src/proxy.ts` or equivalent) — sized for its
  own reviewed change, not a drive-by fix inside a test-writing phase.
  **Recommendation before go-live**: move the `requireAdmin()`/
  `requirePermission()` gate into middleware/proxy for the `/admin/*`
  route group, keeping the `notFound()`-not-redirect behavior for content
  but gaining a real `404` status.

Test file left exactly as originally designed — asserting the real `404`
status the anti-enumeration design intends, not weakened to match the
current, imperfect behavior. It will start passing once the above is fixed;
until then it correctly documents the gap on every run instead of hiding it.

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
| Checkout | VERIFIED | VERIFIED | VERIFIED (`checkout.spec.ts`) | N/A | **Content VERIFIED (invariants clean), non-blocking finding** — see §6.2/6.3, `unstable_cache` stale-render gap |
| Inventory / reservations | VERIFIED | VERIFIED | VERIFIED | N/A | VERIFIED (`commerce-concurrency.spec.ts`, `verify-invariants.mjs` clean under 12-buyer race for 5 units — no oversell) |
| Coupons | VERIFIED | VERIFIED | VERIFIED | N/A | VERIFIED (same run, no `max_uses_total` overage) |
| Orders | VERIFIED | VERIFIED | VERIFIED | N/A | NOT RUN |
| Payments | VERIFIED (74 payment-flow unit tests per `DEPLOY.md`) | VERIFIED | VERIFIED (`payment.spec.ts`, 4 tests × 2 consecutive clean runs) | VERIFIED (real hosted sandbox, this suite) | NOT RUN (`payment-callback.yml` skipped this pass, capped by design — see §6.5) |
| Admin | VERIFIED | VERIFIED | VERIFIED (`admin.spec.ts`) | N/A | VERIFIED (`auth-stress.spec.ts`, §6.4: 4/4 pass) |
| Uploads | VERIFIED | N/A | Not covered by current e2e specs — add before go-live if uploads changed recently | N/A | NOT RUN |
| SEO | N/A | N/A | Manually reviewed §4 this phase, not automated | N/A | N/A |
| Security (rate limiting, RBAC, session) | VERIFIED (`rate-limit` tests, `src/lib/admin/rbac.test.ts`) | VERIFIED | **Content-blocking VERIFIED, status-code NOT VERIFIED** — `rbac.spec.ts` (Phase 8.1 §4, new) confirms `requireAdmin()`/`requirePermission()` correctly withhold real page content in every case tested, but a real Next.js-16 streaming gap means the HTTP status stays `200` instead of `404` — see §8 | N/A | VERIFIED (auth stress, §6.4 — rate limit/lockout/enumeration-resistance) |
| Backups | N/A | Automated dump confirmed running | N/A | N/A | VERIFIED — **restore tested, Phase 8.1, see §7** |

## 10. Remaining blockers before go-live

1. ~~Backup restore has never been exercised.~~ **Resolved, Phase 8.1** —
   real `pg_dump`/`pg_restore` cycle executed against a disposable staging
   Postgres, row counts matched exactly across every table, see §7.
2. ~~Load testing not executed.~~ **Resolved, Phase 8.1** — Artillery +
   Playwright scenarios executed against a disposable staging stack, see
   §6/§9. `payment-callback.yml` still not run by design (§6.5) — not a
   blocker, can be run separately on request.
3. **RBAC status-code gap (§8, new this phase)**: real content-leak
   protection confirmed working (VERIFIED), but `notFound()` called from a
   protected admin page returns HTTP `200` instead of `404` due to Next.js
   16's streaming-status-commit behavior. Recommend moving the permission
   gate into middleware/proxy before go-live so the status code matches the
   anti-enumeration design intent — not a data-exposure risk as-is, but a
   real, currently-failing test and a real gap from the stated design goal.
4. **No down-migration path** — accepted as-is (industry-normal for Drizzle),
   but the *first* real production schema change should be rehearsed
   restore-from-backup once, per item 1, before it's needed for real.
5. Two known, non-blocking application gaps carried from §4 (stale
   `/faq`/`/support` SEO metadata, permanent `unstable_cache` on product
   queries) — recommend follow-up tickets, not a go-live blocker.
6. Every secret that ever touched the two 2026-08-15 commits (§3) should be
   rotated to a fresh value before the production `.env` is written — including
   the `ar-mehdi-privatekey.pem` private key found in `401560b` by this phase's
   gitleaks scan (revoke/reissue, not just a value swap — see §3).

Item 3 needs an application code change (middleware/proxy) to fully close;
everything else is operational/verification.
