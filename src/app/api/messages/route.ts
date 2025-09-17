import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { messages } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { to, content } = body;

    // Security check: reject if user identifier fields provided
    if ('senderId' in body || 'sender_id' in body || 'receiverId' in body || 'receiver_id' in body || 'userId' in body || 'user_id' in body) {
      return NextResponse.json({ 
        error: "User ID cannot be provided in request body",
        code: "USER_ID_NOT_ALLOWED" 
      }, { status: 400 });
    }

    // Validate required fields
    if (!to || isNaN(parseInt(to))) {
      return NextResponse.json({ 
        error: "Valid receiver ID is required",
        code: "MISSING_RECEIVER_ID" 
      }, { status: 400 });
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ 
        error: "Content is required",
        code: "MISSING_CONTENT" 
      }, { status: 400 });
    }

    const now = Date.now();

    const newMessage = await db.insert(messages)
      .values({
        senderId: user.id,
        receiverId: parseInt(to),
        content: content.trim(),
        status: 'sent',
        createdAt: now
      })
      .returning();

    if (newMessage.length === 0) {
      return NextResponse.json({ 
        error: "Failed to create message",
        code: "CREATE_FAILED" 
      }, { status: 500 });
    }

    const message = newMessage[0];

    return NextResponse.json({ 
      message: {
        id: message.id,
        sender_id: message.senderId,
        receiver_id: message.receiverId,
        content: message.content,
        status: message.status,
        created_at: new Date(Number(message.createdAt)).toISOString()
      }
    }, { status: 201 });

  } catch (error) {
    console.error('POST /api/messages error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}