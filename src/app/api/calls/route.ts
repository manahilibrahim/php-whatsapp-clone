import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { calls, users } from '@/db/schema';
import { eq, or, and, desc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

function bigintToISO(timestamp: bigint | null): string | null {
  return timestamp ? new Date(Number(timestamp)).toISOString() : null;
}

function isoToBigint(iso: string | null): bigint | null {
  return iso ? BigInt(new Date(iso).getTime()) : null;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const callsWithUsers = await db
      .select({
        id: calls.id,
        caller_id: calls.callerId,
        callee_id: calls.calleeId,
        status: calls.status,
        started_at: calls.startedAt,
        ended_at: calls.endedAt,
      })
      .from(calls)
      .where(or(eq(calls.callerId, user.id), eq(calls.calleeId, user.id)))
      .orderBy(desc(calls.createdAt));

    const formattedCalls = callsWithUsers.map(call => ({
      id: call.id,
      caller_id: call.caller_id,
      callee_id: call.callee_id,
      status: call.status,
      started_at: bigintToISO(call.started_at),
      ended_at: bigintToISO(call.ended_at),
    }));

    return NextResponse.json({ calls: formattedCalls });
  } catch (error) {
    console.error('GET calls error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { callee_id, status, started_at, ended_at } = body;

    // Security check: reject if user identifier fields are provided
    if ('caller_id' in body || 'callerId' in body) {
      return NextResponse.json({ 
        error: "Caller ID cannot be provided in request body",
        code: "USER_ID_NOT_ALLOWED" 
      }, { status: 400 });
    }

    // Validate required fields
    if (!callee_id) {
      return NextResponse.json({ 
        error: "Callee ID is required",
        code: "MISSING_REQUIRED_FIELD" 
      }, { status: 400 });
    }

    if (!status) {
      return NextResponse.json({ 
        error: "Status is required",
        code: "MISSING_REQUIRED_FIELD" 
      }, { status: 400 });
    }

    // Validate callee exists
    const calleeExists = await db.select().from(users).where(eq(users.id, callee_id)).limit(1);
    if (calleeExists.length === 0) {
      return NextResponse.json({ 
        error: "Callee not found",
        code: "INVALID_CALLEE" 
      }, { status: 400 });
    }

    // Create the call
    const startedAtTimestamp = isoToBigint(started_at);
    const endedAtTimestamp = isoToBigint(ended_at);
    const createdAtTimestamp = BigInt(Date.now());

    const newCall = await db
      .insert(calls)
      .values({
        callerId: user.id,
        calleeId: callee_id,
        status,
        startedAt: startedAtTimestamp,
        endedAt: endedAtTimestamp,
        createdAt: createdAtTimestamp,
      })
      .returning({
        id: calls.id,
        callerId: calls.callerId,
        calleeId: calls.calleeId,
        status: calls.status,
        startedAt: calls.startedAt,
        endedAt: calls.endedAt,
      });

    const formattedCall = {
      id: newCall[0].id,
      caller_id: newCall[0].callerId,
      callee_id: newCall[0].calleeId,
      status: newCall[0].status,
      started_at: bigintToISO(newCall[0].startedAt),
      ended_at: bigintToISO(newCall[0].endedAt),
    };

    return NextResponse.json({ call: formattedCall }, { status: 201 });
  } catch (error) {
    console.error('POST calls error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}