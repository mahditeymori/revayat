// Aggregates raw analytics events + orders into the numbers the admin
// dashboard renders. Pure functions over already-loaded data so they are
// cheap to test and easy to swap onto a real query layer later.
// `.ts` extensions: node --test resolves specifiers literally, so the pure
// aggregation functions below are only testable if the chain is explicit.
import { readEvents, dayKey, type AnalyticsEvent } from './analytics.ts';
import { listOrders, getCatalog, type Order } from './catalog.ts';

export type Point = { day: string; value: number };
export type Ranked = { label: string; id?: number; count: number };

export type Traffic = {
  visitors: number;
  pageviews: number;
  returning: number;
  sessions: number;
  byDay: Point[];
  topPages: Ranked[];
  topReferrers: Ranked[];
};

export type ProductPerf = {
  topViewed: Ranked[];
  topSearched: Ranked[];
  addToCart: number;
  viewToCartRate: number;
  cartToOrderRate: number;
};

export type Sales = {
  revenueRial: number;
  orders: number;
  averageRial: number;
  byDay: Point[];
  topSellers: Ranked[];
  byStatus: Ranked[];
};

const lastDays = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => dayKey(new Date(Date.now() - (n - 1 - i) * 86400_000)));

function rank(counts: Map<string, number>, limit = 8): Ranked[] {
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function tally<T>(items: T[], key: (item: T) => string | undefined): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

export function traffic(events: AnalyticsEvent[], days: number): Traffic {
  const views = events.filter((e) => e.type === 'pageview');

  // A visitor hash rotates daily, so "returning" means seen on >1 distinct day.
  const daysSeen = new Map<string, Set<string>>();
  for (const e of views) {
    const set = daysSeen.get(e.visitor) ?? new Set<string>();
    set.add(e.t.slice(0, 10));
    daysSeen.set(e.visitor, set);
  }

  const perDay = tally(views, (e) => e.t.slice(0, 10));

  return {
    visitors: daysSeen.size,
    pageviews: views.length,
    returning: [...daysSeen.values()].filter((d) => d.size > 1).length,
    // One session = one visitor on one day. Without a session cookie we cannot
    // split a day into visits, and adding one would break the no-cookie promise.
    sessions: [...daysSeen.values()].reduce((sum, d) => sum + d.size, 0),
    byDay: lastDays(days).map((day) => ({ day, value: perDay.get(day) ?? 0 })),
    topPages: rank(tally(views, (e) => e.path)),
    topReferrers: rank(tally(views, (e) => e.ref)),
  };
}

export function productPerf(
  events: AnalyticsEvent[],
  names: Map<number, string>,
  orderCount: number,
): ProductPerf {
  const viewed = events.filter((e) => e.type === 'product_view');
  const carted = events.filter((e) => e.type === 'add_to_cart');

  const byProduct = new Map<string, number>();
  for (const e of viewed) {
    if (e.productId === undefined) continue;
    const label = names.get(e.productId) ?? `#${e.productId}`;
    byProduct.set(label, (byProduct.get(label) ?? 0) + 1);
  }

  return {
    topViewed: rank(byProduct),
    topSearched: rank(tally(events.filter((e) => e.type === 'search'), (e) => e.query)),
    addToCart: carted.length,
    viewToCartRate: viewed.length ? carted.length / viewed.length : 0,
    cartToOrderRate: carted.length ? orderCount / carted.length : 0,
  };
}

export function sales(orders: Order[], days: number): Sales {
  const cutoff = dayKey(new Date(Date.now() - (days - 1) * 86400_000));
  const recent = orders.filter((o) => o.createdAt.slice(0, 10) >= cutoff);
  // Canceled orders are still orders, but they are not revenue.
  const earning = recent.filter((o) => o.status !== 'canceled');

  const revenueRial = earning.reduce((sum, o) => sum + o.totalRial, 0);

  const perDay = new Map<string, number>();
  for (const o of earning) {
    const day = o.createdAt.slice(0, 10);
    perDay.set(day, (perDay.get(day) ?? 0) + o.totalRial);
  }

  const sold = new Map<string, number>();
  for (const o of earning) {
    for (const item of o.items) {
      sold.set(item.name, (sold.get(item.name) ?? 0) + item.quantity);
    }
  }

  return {
    revenueRial,
    orders: recent.length,
    averageRial: earning.length ? Math.round(revenueRial / earning.length) : 0,
    byDay: lastDays(days).map((day) => ({ day, value: perDay.get(day) ?? 0 })),
    topSellers: rank(sold),
    byStatus: rank(tally(recent, (o) => o.status), 5),
  };
}

export async function buildDashboard(days = 30) {
  const [events, orders, catalog] = await Promise.all([
    readEvents(days),
    listOrders(),
    getCatalog(),
  ]);

  const names = new Map(catalog.products.map((p) => [p.id, p.name]));
  const salesReport = sales(orders, days);

  return {
    days,
    traffic: traffic(events, days),
    products: productPerf(events, names, salesReport.orders),
    sales: salesReport,
  };
}
