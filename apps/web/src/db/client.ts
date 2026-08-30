import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

declare global {
  var __revayatDbClient: ReturnType<typeof postgres> | undefined;
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

// Reuse the same connection pool across module reloads in dev (Next.js hot
// reload would otherwise open a fresh pool on every edit and exhaust
// Postgres's max_connections within minutes).
const client =
  global.__revayatDbClient ??
  postgres(connectionString, {
    max: process.env.NODE_ENV === 'production' ? 10 : 5,
  });

if (process.env.NODE_ENV !== 'production') {
  global.__revayatDbClient = client;
}

export const db = drizzle(client, { schema });
