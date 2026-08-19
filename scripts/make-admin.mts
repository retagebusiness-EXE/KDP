/**
 * Promotes a user to ADMIN so they can view /admin.
 * Usage: npx tsx scripts/make-admin.mts you@example.com
 */
import { prisma } from "../src/lib/db";

const email = process.argv[2];
if (!email) {
  console.error("Usage: npx tsx scripts/make-admin.mts <email>");
  process.exit(1);
}

const user = await prisma.user.update({ where: { email }, data: { role: "ADMIN" } }).catch(() => null);
if (!user) {
  console.error(`No user found with email ${email}`);
  process.exit(1);
}
console.log(`${email} is now an ADMIN.`);
