import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, contacts } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    // Join contacts with users table to get contact user details
    const contactsList = await db
      .select({
        id: contacts.contactUserId,
        name: users.name,
        phone: users.phone,
      })
      .from(contacts)
      .innerJoin(users, eq(contacts.contactUserId, users.id))
      .where(eq(contacts.userId, user.id));

    return NextResponse.json({ contacts: contactsList });
  } catch (error) {
    console.error('GET contacts error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { phone } = body;

    // Validation
    if (!phone || typeof phone !== 'string') {
      return NextResponse.json({ 
        error: 'Phone number is required and must be a string',
        code: 'INVALID_PHONE'
      }, { status: 400 });
    }

    // Find user by phone number
    const contactUser = await db
      .select()
      .from(users)
      .where(eq(users.phone, phone))
      .limit(1);

    if (contactUser.length === 0) {
      return NextResponse.json({ 
        error: 'User with this phone number not found',
        code: 'USER_NOT_FOUND'
      }, { status: 404 });
    }

    const contactUserData = contactUser[0];

    // Check if contact relationship already exists
    const existingContact = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.userId, user.id),
          eq(contacts.contactUserId, contactUserData.id)
        )
      )
      .limit(1);

    if (existingContact.length > 0) {
      // Contact already exists, return existing contact
      return NextResponse.json({ 
        contact: { 
          id: contactUserData.id, 
          name: contactUserData.name, 
          phone: contactUserData.phone 
        } 
      }, { status: 201 });
    }

    // Create new contact relationship
    const currentTime = BigInt(Date.now());
    await db
      .insert(contacts)
      .values({
        userId: user.id,
        contactUserId: contactUserData.id,
        createdAt: currentTime,
      });

    return NextResponse.json({ 
      contact: { 
        id: contactUserData.id, 
        name: contactUserData.name, 
        phone: contactUserData.phone 
      } 
    }, { status: 201 });
  } catch (error) {
    console.error('POST contacts error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}