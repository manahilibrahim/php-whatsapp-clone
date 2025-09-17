import { db } from '@/db';
import { contacts } from '@/db/schema';

async function main() {
  const now = Date.now();
  const sampleContacts = [
    { userId: 1, contactUserId: 2, alias: null, createdAt: BigInt(now) },
    { userId: 1, contactUserId: 3, alias: null, createdAt: BigInt(now + 1) },
    { userId: 2, contactUserId: 1, alias: null, createdAt: BigInt(now + 2) },
    { userId: 2, contactUserId: 3, alias: null, createdAt: BigInt(now + 3) },
    { userId: 3, contactUserId: 1, alias: null, createdAt: BigInt(now + 4) },
  ];

  await db.insert(contacts).values(sampleContacts);
  console.log('✅ Contacts seeder completed successfully');
}

main().catch((error) => {
  console.error('❌ Seeder failed:', error);
});