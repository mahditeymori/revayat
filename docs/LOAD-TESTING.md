# Load testing (Phase 8, §6)

Scripts only — **nothing in `load-tests/` has been executed this session.**
The user's explicit instruction for this phase was to prepare repeatable
tooling, not to run it: no staging environment exists yet, and running real
concurrent load against the shared local dev Postgres would risk
destabilizing state the e2e/unit suites also depend on. Run this before
go-live, against a disposable target — never against `revayat.shop`.

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
