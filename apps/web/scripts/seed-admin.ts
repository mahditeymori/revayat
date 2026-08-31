// Bootstraps the first OWNER admin account. Run once against a live
// database before any admin can log in: `ADMIN_EMAIL=... ADMIN_PASSWORD=...
// npm run db:seed-admin`. Refuses to run if any admin already exists — use
// the /admin/admins UI (owner-only) to add more after that.
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client';
import { admins } from '../src/db/schema';

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
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
