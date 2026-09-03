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

**Secrets audit** (git history + current tree, this session):
- Current tracked tree: clean — `git grep` for `ZIBAL_MERCHANT=`/`ADMIN_SESSION_SECRET=`/`POSTGRES_PASSWORD=`/`DATABASE_URL=` outside `.env.example`/docs found only the intentional fake build-time placeholder in `Dockerfile:19` (`postgresql://build:build@localhost:5432/build`, never reachable, documented as build-only).
- Git history: `.env` and `apps/web/.env.local` **were** committed in the
  repo's first two commits (`401560b`, `cb10f00`, 2026-08-15) before
  `.gitignore` picked them up — not rewritten (private repo, already a
  known/accepted tradeoff documented in `DEPLOY.md`'s admin-secret-rotation
  section). **Action before go-live**: treat every value that ever appeared
  in those two commits as burned — generate fresh `POSTGRES_PASSWORD`,
  `ADMIN_SESSION_SECRET`, and `ZIBAL_MERCHANT` (real merchant, not the
  sandbox literal) for the production `.env`, never reused from a laptop
  `.env`/`.env.local` that predates this check.

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

See `docs/LOAD-TESTING.md` — scripts prepared, **not executed** this phase
(no staging environment available; user declined running load against local
dev in this session). Execute before go-live, against a non-production
target, before checking §8's LOAD TEST row anywhere other than "NOT RUN".

## 7. Backup and recovery readiness

- **Backup**: automated, already running whenever the `backup` compose
  service is up — `pg_dump -Fc` on boot + every `BACKUP_INTERVAL_HOURS`
  (default 24h), retained `BACKUP_RETENTION_DAYS` (default 14), written to
  the `revayat_backups` volume (`pg-backup-entrypoint.sh`).
- **Restore procedure**: documented in `DEPLOY.md` → "Restore"
  (`pg_restore --clean --if-exists` after `docker compose stop web`).
- **Restore tested**: **NO.** Per the standing rule not to claim backup
  readiness before restore is verified — this has not been exercised in
  this session (would require a disposable Postgres instance to restore
  into; not done here to avoid any risk to the shared local dev DB used by
  the e2e/unit suites). **Blocker for go-live sign-off**: dry-run a full
  `pg_dump` → `pg_restore` cycle against a throwaway database before trusting
  this backup path in an incident.

## 8. Final verification matrix

Legend: **VERIFIED** = evidence from an actual run this session or a prior
completed phase · **NOT RUN** = prepared but not executed · **N/A** = doesn't
apply to that layer.

| Area | Unit | DB | Browser (e2e) | Zibal sandbox | Load test |
|---|---|---|---|---|---|
| Storefront (home/collections/product) | VERIFIED | VERIFIED (live queries in e2e) | VERIFIED (`storefront.spec.ts`) | N/A | NOT RUN |
| Search | VERIFIED | VERIFIED | VERIFIED | N/A | NOT RUN |
| Variants | VERIFIED | VERIFIED | VERIFIED | N/A | NOT RUN |
| Cart | VERIFIED | VERIFIED | VERIFIED (`cart.spec.ts`) | N/A | NOT RUN |
| Checkout | VERIFIED | VERIFIED | VERIFIED (`checkout.spec.ts`) | N/A | NOT RUN |
| Inventory / reservations | VERIFIED | VERIFIED | VERIFIED | N/A | NOT RUN |
| Coupons | VERIFIED | VERIFIED | VERIFIED | N/A | NOT RUN |
| Orders | VERIFIED | VERIFIED | VERIFIED | N/A | NOT RUN |
| Payments | VERIFIED (74 payment-flow unit tests per `DEPLOY.md`) | VERIFIED | VERIFIED (`payment.spec.ts`, 4 tests × 2 consecutive clean runs) | VERIFIED (real hosted sandbox, this suite) | NOT RUN |
| Admin | VERIFIED | VERIFIED | VERIFIED (`admin.spec.ts`) | N/A | NOT RUN |
| Uploads | VERIFIED | N/A | Not covered by current e2e specs — add before go-live if uploads changed recently | N/A | NOT RUN |
| SEO | N/A | N/A | Manually reviewed §4 this phase, not automated | N/A | N/A |
| Security (rate limiting, RBAC, session) | VERIFIED (`rate-limit` tests, `src/lib/admin/rbac.test.ts`) | VERIFIED | **Gap** — `admin.spec.ts` has zero role/RBAC assertions (confirmed via grep: no `editor`/`support`/`owner`/`role` matches); only login itself is browser-tested | N/A | NOT RUN (auth stress, §6.4) |
| Backups | N/A | Automated dump confirmed running | N/A | N/A | N/A — **restore untested, see §7** |

## 9. Remaining blockers before go-live

1. **Backup restore has never been exercised.** Highest-priority gap — an
   unverified backup is not a backup.
2. **Load testing not executed** — no scenario has run against any target
   yet; §8's load-test column is `NOT RUN` everywhere.
3. **RBAC has no browser-level coverage.** `src/lib/admin/rbac.test.ts` unit-
   tests the permission logic itself, but `apps/web/e2e/admin.spec.ts` never
   logs in as `editor`/`support` and asserts an owner-only page is actually
   blocked end-to-end (confirmed: zero role-related matches in that file).
   Add before go-live, or accept the unit coverage as sufficient — this is a
   judgment call, not a hard blocker, since the logic itself is tested.
4. **No down-migration path** — accepted as-is (industry-normal for Drizzle),
   but the *first* real production schema change should be rehearsed
   restore-from-backup once, per item 1, before it's needed for real.
5. Two known, non-blocking application gaps carried from §4 (stale
   `/faq`/`/support` SEO metadata, permanent `unstable_cache` on product
   queries) — recommend follow-up tickets, not a go-live blocker.
6. Every secret that ever touched the two 2026-08-15 commits (§3) should be
   rotated to a fresh value before the production `.env` is written.

Nothing above requires an application code change to resolve except item 3
(verifying, not necessarily changing, existing test coverage) — all are
operational/verification steps.
