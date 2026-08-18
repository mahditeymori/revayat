// Run: npm test   (node --test --experimental-strip-types, no framework)
import test from 'node:test';
import assert from 'node:assert/strict';
import { traffic, productPerf, sales, consentStats } from './reports.ts';
import type { AnalyticsEvent } from './analytics.ts';
import type { Order } from './catalog.ts';

const day = (back: number) => new Date(Date.now() - back * 86400_000).toISOString();

const view = (
  visitor: string,
  back: number,
  path = '/',
  ref?: string,
  session?: string,
): AnalyticsEvent => ({
  t: day(back),
  type: 'pageview',
  path,
  visitor,
  session,
  ref,
});

test('traffic counts visitors, returning and sessions distinctly', () => {
  const t = traffic(
    [
      view('a', 0, '/', undefined, 's1'),
      view('a', 0, '/', undefined, 's1'), // same visit
      view('a', 0, '/', undefined, 's2'), // came back after the 30min gap
      view('a', 1, '/', undefined, 's3'), // another day -> returning
      view('b', 0, '/', undefined, 's4'),
    ],
    7,
  );
  assert.equal(t.pageviews, 5);
  assert.equal(t.visitors, 2);
  assert.equal(t.returning, 1); // only "a" was seen on more than one day
  assert.equal(t.sessions, 4);  // two visits from a on day 0, not one
});

test('traffic falls back to visitor+day for events recorded before session ids', () => {
  const t = traffic([view('a', 0), view('a', 0), view('a', 1), view('b', 0)], 7);
  assert.equal(t.sessions, 3); // a×2 days + b×1 day — old data still counts
});

test('traffic byDay covers the whole window, zero-filled and oldest-first', () => {
  const t = traffic([view('a', 0), view('b', 2)], 5);
  assert.equal(t.byDay.length, 5);
  assert.ok(t.byDay[0].day < t.byDay[4].day);
  assert.equal(t.byDay.at(-1)?.value, 1); // today
  assert.equal(t.byDay[3].value, 0);      // yesterday had nothing
});

test('traffic ranks pages and drops events with no referrer', () => {
  const t = traffic([view('a', 0, '/x', 'google.com'), view('b', 0, '/x'), view('c', 0, '/y')], 7);
  assert.deepEqual(t.topPages[0], { label: '/x', count: 2 });
  assert.equal(t.topReferrers.length, 1);
});

test('productPerf computes funnel rates and survives an empty funnel', () => {
  const events: AnalyticsEvent[] = [
    { t: day(0), type: 'product_view', path: '/p', visitor: 'a', productId: 1 },
    { t: day(0), type: 'product_view', path: '/p', visitor: 'b', productId: 1 },
    { t: day(0), type: 'product_view', path: '/p', visitor: 'c', productId: 2 },
    { t: day(0), type: 'add_to_cart', path: '/p', visitor: 'a', productId: 1 },
    { t: day(0), type: 'purchase', path: '/checkout', visitor: 'server', consented: true },
    { t: day(0), type: 'search', path: '/search', visitor: 'a', query: 'دماوند' },
  ];
  const p = productPerf(events, new Map([[1, 'دماوند']]));
  assert.deepEqual(p.topViewed[0], { label: 'دماوند', count: 2 });
  assert.equal(p.topViewed[1].label, '#2'); // unknown id falls back, never crashes
  assert.equal(p.topSearched[0].label, 'دماوند');
  assert.equal(p.viewToCartRate, 1 / 3);
  assert.equal(p.cartToOrderRate, 1);

  const zero = productPerf([], new Map());
  assert.equal(zero.viewToCartRate, 0); // no divide-by-zero NaN in the dashboard
  assert.equal(zero.cartToOrderRate, 0);
});

test('cartToOrderRate ignores orders from visitors who declined analytics', () => {
  // The bug this guards: add_to_cart exists only for consented visitors, so
  // counting every order against it pushes the rate above 100%.
  const events: AnalyticsEvent[] = [
    { t: day(0), type: 'add_to_cart', path: '/p', visitor: 'a', productId: 1 },
    { t: day(0), type: 'purchase', path: '/checkout', visitor: 'server', consented: true },
    { t: day(0), type: 'purchase', path: '/checkout', visitor: 'server', consented: false },
    { t: day(0), type: 'purchase', path: '/checkout', visitor: 'server', consented: false },
  ];
  assert.equal(productPerf(events, new Map()).cartToOrderRate, 1);

  // Rows written before the banner shipped carry no flag — those visitors were
  // all tracked, so dropping them would silently deflate historical rates.
  const legacy: AnalyticsEvent[] = [
    { t: day(0), type: 'add_to_cart', path: '/p', visitor: 'a', productId: 1 },
    { t: day(0), type: 'purchase', path: '/checkout', visitor: 'server' },
  ];
  assert.equal(productPerf(legacy, new Map()).cartToOrderRate, 1);
});

test('consentStats counts both answers and reports no rate before anyone answers', () => {
  const events: AnalyticsEvent[] = [
    { t: day(0), type: 'consent', path: '/', visitor: 'a', decision: 'yes' },
    { t: day(0), type: 'consent', path: '/', visitor: 'b', decision: 'yes' },
    { t: day(0), type: 'consent', path: '/', visitor: 'c', decision: 'yes' },
    { t: day(0), type: 'consent', path: '/', visitor: 'anon', decision: 'no' },
    { t: day(0), type: 'pageview', path: '/', visitor: 'a' }, // not an answer
  ];
  const c = consentStats(events);
  assert.equal(c.accepted, 3);
  assert.equal(c.declined, 1);
  assert.equal(c.acceptRate, 0.75);

  // null, not 0: "nobody has answered" and "everybody refused" are different
  // facts, and showing 0% for the first one would be a lie in the admin panel.
  assert.equal(consentStats([]).acceptRate, null);
});

const order = (back: number, totalRial: number, status: Order['status'], qty = 1): Order =>
  ({
    id: back * 1000 + totalRial,
    createdAt: day(back),
    status,
    totalRial,
    customer: {} as Order['customer'],
    items: [{ productId: 1, name: 'دماوند', image: '', size: 'L', color: 'مشکی', quantity: qty, priceRial: totalRial }],
  }) as Order;

test('sales excludes canceled orders from revenue but not from the order count', () => {
  const s = sales([order(0, 1000, 'new'), order(1, 500, 'canceled'), order(40, 9999, 'new')], 30);
  assert.equal(s.revenueRial, 1000);
  assert.equal(s.orders, 2);        // canceled still counts as an order placed
  assert.equal(s.averageRial, 1000); // averaged over earning orders only
  assert.equal(s.topSellers[0].count, 1); // the canceled order's item is not "sold"
  assert.equal(s.byStatus.length, 2);
});

test('sales handles no orders without NaN', () => {
  const s = sales([], 30);
  assert.equal(s.revenueRial, 0);
  assert.equal(s.averageRial, 0);
  assert.equal(s.byDay.length, 30);
});
