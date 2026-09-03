// Safety net for the full-suite run: removes any leftover e2e-created orders
// a spec's own cleanup didn't catch (e.g. a hard crash before its afterAll
// ran). Deliberately NOT time-windowed — matches only rows carrying the
// fixture's exact test markers (shippingName + shippingAddress), both set
// exclusively by e2e/helpers.ts's fillShippingForm, never by a real
// customer, so it can never touch unrelated or production data regardless
// of how old they are. The one fixture order (matched by its stable
// cartToken) is explicitly excluded and always survives.
//
// shippingAddress is matched as a suffix, not equality: checkout/actions.ts
// stores `${state}، ${city}، ${address}` — fillShippingForm's raw
// FIXTURES.shippingAddress ends up prefixed with the province/city fields,
// never stored verbatim.
//
// Own bare connection, not src/db/client.ts: that module imports
// 'server-only', which throws outside a Next.js bundle — same pattern as
// e2e/global-setup.ts.
import postgres from 'postgres';
import { FIXTURES } from './fixtures.ts';

export default async function globalTeardown() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return;

  const sql = postgres(connectionString, { max: 1 });
  try {
    const deleted = await sql`
      delete from orders
      where shipping_name = ${FIXTURES.shippingName}
        and shipping_address like ${'%' + FIXTURES.shippingAddress}
        and cart_token <> ${FIXTURES.orderCartToken}
      returning id
    `;
    console.log(`[e2e:global-teardown] removed ${deleted.length} leftover e2e order(s)`);
  } finally {
    await sql.end();
  }
}
