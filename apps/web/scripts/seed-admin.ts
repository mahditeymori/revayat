// Bootstraps the first OWNER admin account. Run once against a live
// database before any admin can log in: `ADMIN_EMAIL=... ADMIN_PASSWORD=...
// npm run db:seed-admin`. Refuses to run if any admin already exists — use
// the /admin/admins UI (owner-only) to add more after that.
import bcrypt from 'bcryptjs';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import { admins } from '../src/db/schema.ts';

// Own connection, not src/db/client.ts: that module imports 'server-only',
// which throws unconditionally outside a Next.js bundle. Standalone scripts
// run under plain node, so they need a bare drizzle client (same pattern as
// migrate.mjs).
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('[seed-admin] DATABASE_URL is not set');
  process.exit(1);
}
const client = postgres(connectionString, { max: 1 });
const db = drizzle(client, { schema: { admins } });

const BCRYPT_ROUNDS = 12;

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('Usage: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=... npm run db:seed-admin');
    process.exit(1);
  }
  if (password.length < 10) {
    console.error('ADMIN_PASSWORD must be at least 10 characters.');
    process.exit(1);
  }

  const existing = await db.query.admins.findFirst({ where: eq(admins.email, email) });
  if (existing) {
    console.error(`Admin ${email} already exists.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  await db.insert(admins).values({ email, passwordHash, role: 'owner' });
  console.log(`[seed-admin] created owner admin: ${email}`);
}

main()
  .then(() => client.end())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
