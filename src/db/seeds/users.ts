import { db } from '@/db';
import { users } from '@/db/schema';
import bcrypt from 'bcrypt';

async function main() {
    const passwordHash1 = await bcrypt.hash('password123', 10);
    const passwordHash2 = await bcrypt.hash('password123', 10);
    const passwordHash3 = await bcrypt.hash('password123', 10);
    
    const sampleUsers = [
        {
            phone: '+15550000001',
            name: 'Alice Johnson',
            passwordHash: passwordHash1,
            createdAt: BigInt(Date.now()),
        },
        {
            phone: '+15550000002',
            name: 'Bob Smith',
            passwordHash: passwordHash2,
            createdAt: BigInt(Date.now() + 1000),
        },
        {
            phone: '+15550000003',
            name: 'Charlie Brown',
            passwordHash: passwordHash3,
            createdAt: BigInt(Date.now() + 2000),
        }
    ];

    await db.insert(users).values(sampleUsers);
    
    console.log('✅ Users seeder completed successfully');
}

main().catch((error) => {
    console.error('❌ Seeder failed:', error);
});