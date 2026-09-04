// Idempotent: creates the three baseline storefront categories if missing.
// Run once against a live database: `npm run db:seed-categories`.
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import { categories } from '../src/db/schema.ts';

// Own connection, not src/db/client.ts: see seed-admin.ts for why.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('[seed-categories] DATABASE_URL is not set');
  process.exit(1);
}
const client = postgres(connectionString, { max: 1 });
const db = drizzle(client, { schema: { categories } });

const SEED_CATEGORIES = [
  { slug: 'tishirt', name: 'تی‌شرت', sortOrder: 1 },
  { slug: 'hoodie', name: 'هودی', sortOrder: 2 },
  { slug: 'sweatshirt', name: 'دورس', sortOrder: 3 },
];

async function main() {
  for (const category of SEED_CATEGORIES) {
    const existing = await db.query.categories.findFirst({ where: eq(categories.slug, category.slug) });
    if (existing) {
      console.log(`[seed-categories] skip (exists): ${category.slug}`);
      continue;
    }
    await db.insert(categories).values(category);
    console.log(`[seed-categories] created: ${category.slug}`);
  }
}

main()
  .then(() => client.end())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
