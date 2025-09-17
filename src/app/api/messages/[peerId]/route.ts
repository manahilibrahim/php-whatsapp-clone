import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { messages, users } from '@/db/schema';
import { eq, or, and, asc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { peerId: string } }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const peerId = params.peerId;
    if (!peerId || isNaN(parseInt(peerId))) {
      return NextResponse.json({ 
        error: 'Valid peerId is required',
        code: 'INVALID_PEER_ID'
      }, { status: 400 });
    }

    const peerUserId = parseInt(peerId);

    // Verify that the peer exists
    const peerUser = await db.select()
      .from(users)
      .where(eq(users.id, peerUserId))
      .limit(1);

    if (peerUser.length === 0) {
      return NextResponse.json({ 
        error: 'Peer user not found',
        code: 'PEER_NOT_FOUND'
      }, { status: 404 });
    }

    // Get messages between current user and peer (both directions)
    const messageResults = await db.select({
      id: messages.id,
      senderId: messages.senderId,
      receiverId: messages.receiverId,
      content: messages.content,
      status: messages.status,
      createdAt: messages.createdAt
    })
      .from(messages)
      .where(
        or(
          and(
            eq(messages.senderId, user.id),
            eq(messages.receiverId, peerUserId)
          ),
          and(
            eq(messages.senderId, peerUserId),
            eq(messages.receiverId, user.id)
          )
        )
      )
      .orderBy(asc(messages.createdAt));

    // Convert bigint timestamps to ISO strings
    const formattedMessages = messageResults.map(msg => ({
      id: msg.id,
      sender_id: msg.senderId,
      receiver_id: msg.receiverId,
      content: msg.content,
      status: msg.status,
      created_at: new Date(Number(msg.createdAt)).toISOString()
    }));

    return NextResponse.json({ messages: formattedMessages }, { status: 200 });

  } catch (error) {
    console.error('GET messages error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}