# Load testing (Phase 8, §6)

Executed for real in Phase 8.1 against a disposable staging stack — see
"Actual run results" below. Never run against `revayat.shop`.

Isolated on purpose: `load-tests/package.json` is its own npm package, own
`node_modules`, own devDependencies (`artillery`, `@playwright/test`,
`postgres`, `bcryptjs`). It is never referenced from `apps/web/package.json`
or its lockfile, so this tooling can never affect the production build.

## Why two different tools

Checkout, cart, and admin-login mutations are Next.js Server Actions
(`'use server'` — e.g. `apps/web/src/app/cart/actions.ts`), not plain HTTP
endpoints. A Server Action's wire format is a build-specific hashed
reference — Artillery/k6 cannot call one directly. So:

- **Artillery** (`storefront.yml`, `payment-callback.yml`) — plain GET
  routes only: storefront pages, and the `/payment/callback` Route Handler.
- **Playwright** (`commerce-concurrency.spec.ts`, `auth-stress.spec.ts`) —
  anything that has to go through a Server Action. Each virtual user is a
  real `BrowserContext`; concurrency comes from `Promise.all` over many
  contexts hitting the real form submission at once.

## Setup

```bash
cd load-tests
npm install
npx playwright install --with-deps chromium   # if not already present from apps/web
```

Needs a running app pointed at a disposable database — start it the same
way `apps/web`'s own e2e suite does (`npm run dev -- -p 3002` from
`apps/web`, or `docker compose up` against a throwaway `DATABASE_URL`).
Every script reads `DATABASE_URL` from the environment (no `.env.local`
auto-load in this package — export it, or run via `node --env-file=...`
pointed at a copy of `apps/web/.env.local`).

## Running each scenario

```bash
npm run seed                          # loadtest-category/product/coupon fixtures (upsert, safe to rerun)

# §6.1 — storefront reads
npm run storefront

# §6.2 / §6.3 — concurrent checkout, inventory, coupon races
npm run commerce

# §6.4 — admin login rate limiting / lockout / concurrent sessions
npm run auth

# §6.5 — duplicate/concurrent payment callback (real Zibal SANDBOX only;
# requires ZIBAL_MERCHANT=zibal — refuses to run against a real merchant id)
npm run payment-callback

npm run verify                        # invariant check: stock, reservations, coupon usage, double-settlement
npm run teardown                      # deletes load-test-created orders (fixture rows are upsert-safe, left as-is)
```

Run `verify` after *every* scenario, not just at the end — the invariants
(`load-tests/verify-invariants.mjs`) are what actually decide pass/fail:
negative stock, oversold reservations, a coupon over its `max_uses_total`,
or an order with two `succeeded` payments.

## §6.6 Resource monitoring

Record these manually alongside each run — no monitoring is wired into the
scripts themselves (out of scope for "scripts only, no execution" this
phase):

| Layer | What to watch | How |
|---|---|---|
| Application | CPU/RAM, response latency, Node memory, error logs | `docker stats web` · `docker compose logs -f web` · Artillery's own `p99`/`errorRate` report · Playwright's console output |
| Database | Active connections, slow queries, locks, transaction duration | `select count(*) from pg_stat_activity;` · `select * from pg_stat_activity where state != 'idle';` · `select * from pg_locks where not granted;` |
| Docker | Container memory, restart behavior | `docker stats` · `docker compose ps` (restart count) · `docker compose logs db` for OOM kills |

On Windows without `docker stats` piped anywhere durable, Task Manager's
per-process view on the `docker` / `com.docker.backend` process is the
closest equivalent for a quick manual check during a run.

## What each scenario does and does not prove

- **`storefront.yml`** — read-path latency/error-rate/throughput under
  concurrent browsing. Does not touch mutation paths.
- **`commerce-concurrency.spec.ts`** — whether the stock/coupon locks
  actually hold under real concurrent writers. Deliberately over-subscribes
  a scarce fixture (12 buyers for 5 units of stock; `MAX_USES_TOTAL + 5`
  coupon attempts) so a broken lock would show as `stock < 0` or
  `used > max_uses_total` in `verify-invariants.mjs`, not just as flaky test
  output.
- **`auth-stress.spec.ts`** — rate-limit and lockout thresholds (mirrored
  from `apps/web/src/lib/admin/login.ts`, not guessed), account-enumeration
  resistance, and that concurrent successful logins each get an
  independent, uncorrupted session row.
- **`payment-callback.yml`** — duplicate-callback idempotency under
  concurrency (same test as `apps/web/e2e/payment.spec.ts`'s "replaying the
  same callback" case, but with 15 concurrent replays instead of one
  sequential one). Fixed, low volume by design — this is a real sandbox
  request per replay, not something to scale up carelessly.
- **None of these measure sustained throughput ceilings or find the
  server's actual breaking point** — the phase counts/durations here are
  starting points for a first run, not a claim about capacity. Adjust
  `arrivalRate`/`CONCURRENT_USERS` once a real run's numbers are in hand.

## Actual run results — 2026-09 (Phase 8.1)

Target: disposable Docker Postgres (`revayat-staging-db`, its own volume,
port 5433) restored from a real `pg_restore` of dev-DB data, plus a
disposable production-build `npm start` app process on port 3003. Both
torn down after this run — see `docs/CUTOVER-CHECKLIST.md` §7 for the
backup/restore verification this reused.

### §6.1 `storefront.yml`

4,033 requests, **0 failures**, all `200`. p95 = 6ms, p99 = 7.9ms, mean
throughput 13 req/s. No sign of the read path being a bottleneck at this
scale.

### §6.2/§6.3 `commerce-concurrency.spec.ts` — genuine finding, not a data-integrity failure

`verify-invariants.mjs` stayed clean across every run (no negative stock,
no oversold reservations, no coupon overuse) — the actual reservation
locking holds under concurrency. The test itself still fails on an
unrelated, real bug: `apps/web/src/lib/commerce/products.ts` wraps
`getProduct`/`getProducts`/`getProductRecommendations` in `unstable_cache`
with **no `revalidateTag` call anywhere in `src`** — once a product slug is
first read by a running server process, that snapshot (including its
stock-derived "in stock" render) is served for the rest of that process's
life, regardless of later DB writes.

Under the 12-concurrent-buyer race for 5 units of stock, whichever request
happens to populate the cache can freeze a page render captured mid-race
(when concurrent reservations were still in flight) and serve that same
stale "out of stock" state to every later request — even though live stock
is fine and no data was actually corrupted. Reproduced twice identically,
including after a full server restart + fresh seed, with an empty
`server.log` both times (rules out a crash — purely a stale read). Reducing
concurrency to 3 buyers reproduced it just as reliably, ruling out simple
resource contention.

This was already flagged as a non-blocking cosmetic gap (§4). This run
upgrades it: under concurrent/flash-sale-style traffic it can show real
customers a wrong "sold out" state on a page load, even though checkout
itself stays correct. **Recommendation before go-live**: add
`revalidateTag('products')` calls at the write sites (`checkout`
submission, admin stock edits) — small, targeted, not attempted here per
this phase's "test tooling only, no application changes" scope.

### §6.4 `auth-stress.spec.ts` — all 4 pass

Two genuine, previously-latent bugs found on this file's first-ever
execution (its own header comment confirmed it had never been run before):

1. **Test-tooling bug**: `attemptLogin`'s `waitForURL` used a loose,
   unanchored regex and ran *after* the click instead of racing it —
   trivially matched the pre-navigation URL, occasionally reading the
   query string before the real redirect landed. Fixed by racing the click
   and a precise `waitForURL` predicate together via `Promise.all`.
2. **Cross-test isolation bug**: all 4 tests share one fixture admin row
   and rate-limit keys, isolated only by a `beforeEach` reset — not
   sufficient once the config's `fullyParallel: true` let multiple tests
   from this file run concurrently against each other. Fixed by wrapping
   the file's tests in `test.describe.serial(...)`, scoped to this one
   file (`commerce-concurrency.spec.ts` intentionally needs real
   concurrency and was left untouched).

A third assertion was over-specified, not a bug: after 5 failed attempts,
a 6th attempt is *both* locked out and past the email-scoped rate limit
(same threshold, 5) — `loginAdmin` checks rate-limit first, so `'rate-limited'`
is as correct a rejection as `'locked'`. Relaxed the assertion to accept
either.

Final result: 4/4 passed — account-enumeration resistance, sequential
lockout, concurrent-burst rate limiting, and concurrent-correct-login
session integrity all verified.

### §6.5 `payment-callback.yml`

Not run this pass (real Zibal sandbox network calls, capped at 15 by
design) — run separately on request, per the original scope note above.

### §6.6 Resource metrics

Captured after the load-test runs above, staging stack still warm:

| Metric | Value |
|---|---|
| DB connections (`pg_stat_activity` total) | 26 |
| DB active (non-idle) queries | 1 (the monitoring query itself) — no long-running or blocked queries observed |
| DB container memory | 85.9 MiB / 7.57 GiB (1.1%) |
| App process (`npm start`, standalone) memory (RSS) | ~70.7 MiB |

No connection-pool exhaustion, no slow-query buildup, no elevated memory —
all well within headroom at this traffic level. These numbers reflect a
single-instance, single-container disposable stack, not production
infrastructure sizing.
