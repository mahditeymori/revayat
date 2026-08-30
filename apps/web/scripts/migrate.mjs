// Runs pending Drizzle migrations against DATABASE_URL. Used by
// docker-entrypoint.sh on every container boot — safe to run repeatedly,
// drizzle tracks already-applied migrations in its own `__drizzle_migrations`
// table. Plain Node/ESM only (no drizzle-kit): the production runner image
// doesn't ship devDependencies.
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('[migrate] DATABASE_URL is not set');
  process.exit(1);
}

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

await migrate(db, { migrationsFolder: new URL('../src/db/migrations', import.meta.url).pathname });
await client.end();
console.log('[migrate] up to date');
