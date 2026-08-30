// Creates the first admin account (role: owner). Run once against a fresh
// database:
//   ADMIN_EMAIL=owner@revayat.shop ADMIN_PASSWORD=... npm run db:seed-admin
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client';
import { admins } from '../src/db/schema';

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('Usage: ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run db:seed-admin');
    process.exit(1);
  }
  if (password.length < 12) {
    console.error('ADMIN_PASSWORD must be at least 12 characters.');
    process.exit(1);
  }

  const existing = await db.query.admins.findFirst({ where: eq(admins.email, email) });
  if (existing) {
    console.error(`An admin with email ${email} already exists.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [created] = await db
    .insert(admins)
    .values({ email, passwordHash, role: 'owner' })
    .returning({ id: admins.id, email: admins.email, role: admins.role });

  console.log(`Created admin ${created.email} (${created.role}, id=${created.id})`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
