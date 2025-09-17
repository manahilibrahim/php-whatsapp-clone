import { db } from '@/db';
import { messages } from '@/db/schema';

async function main() {
  const baseTimestamp = new Date('2024-01-15T14:30:00Z').getTime();

  const sampleMessages = [
    {
      senderId: 1,
      receiverId: 2,
      content: "Hey Bob! Are you free for lunch today?",
      status: 'sent',
      createdAt: BigInt(baseTimestamp),
    },
    {
      senderId: 2,
      receiverId: 1,
      content: "Hey Alice! Yeah I can do lunch. How about 12:30 at the new Italian place on Main Street?",
      status: 'sent',
      createdAt: BigInt(baseTimestamp + 30_000),
    },
    {
      senderId: 1,
      receiverId: 2,
      content: "That sounds perfect. I've been wanting to try that place. I'll see you there at 12:30!",
      status: 'sent',
      createdAt: BigInt(baseTimestamp + 120_000),
    },
    {
      senderId: 2,
      receiverId: 1,
      content: 'By the way, are we still on for the project meeting tomorrow? I have some ideas to discuss.',
      status: 'sent',
      createdAt: BigInt(baseTimestamp + 180_000),
    },
    {
      senderId: 1,
      receiverId: 2,
      content: 'Yes, definitely! Let me mark that in my calendar. Should we meet in the morning or afternoon?',
      status: 'sent',
      createdAt: BigInt(baseTimestamp + 240_000),
    },
    {
      senderId: 2,
      receiverId: 1,
      content: "Let's do afternoon, around 2pm. Looking forward to hearing your thoughts on the marketing proposal.",
      status: 'sent',
      createdAt: BigInt(baseTimestamp + 300_000),
    },
  ];

  await db.insert(messages).values(sampleMessages);

  console.log('✅ Messages seeder completed successfully');
}

main().catch((error) => {
  console.error('❌ Seeder failed:', error);
});