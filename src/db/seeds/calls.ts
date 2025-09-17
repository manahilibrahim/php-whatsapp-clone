import { db } from '@/db';
import { calls } from '@/db/schema';

async function main() {
    const sampleCalls = [
        {
            callerId: 1,
            calleeId: 2,
            status: 'completed',
            startedAt: 1705274400000n,
            endedAt: 1705276200000n,
            createdAt: 1705274400000n,
        },
        {
            callerId: 2,
            calleeId: 1,
            status: 'missed',
            startedAt: 1705296000000n,
            endedAt: 1705296000000n,
            createdAt: 1705296000000n,
        },
        {
            callerId: 1,
            calleeId: 3,
            status: 'ongoing',
            startedAt: 1705306800000n,
            endedAt: null,
            createdAt: 1705306800000n,
        },
    ];

    await db.insert(calls).values(sampleCalls);
    
    console.log('✅ Calls seeder completed successfully');
}

main().catch((error) => {
    console.error('❌ Seeder failed:', error);
});