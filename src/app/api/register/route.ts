import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { hashPassword, generateToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, name, password } = body;

    // Validate all fields are present and non-empty
    if (!phone || !name || !password) {
      return NextResponse.json({ 
        error: 'All fields (phone, name, password) are required',
        code: 'MISSING_REQUIRED_FIELDS'
      }, { status: 400 });
    }

    // Validate field types
    if (typeof phone !== 'string' || typeof name !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ 
        error: 'Invalid field types',
        code: 'INVALID_FIELD_TYPES'
      }, { status: 400 });
    }

    // Validate phone format (basic validation)
    const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
    if (!phoneRegex.test(phone)) {
      return NextResponse.json({ 
        error: 'Invalid phone format',
        code: 'INVALID_PHONE_FORMAT'
      }, { status: 400 });
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json({ 
        error: 'Password must be at least 6 characters long',
        code: 'WEAK_PASSWORD'
      }, { status: 400 });
    }

    // Trim and normalize inputs
    const trimmedPhone = phone.trim();
    const trimmedName = name.trim();

    // Check if phone already exists
    const existingUser = await db.select()
      .from(users)
      .where(eq(users.phone, trimmedPhone))
      .limit(1);

    if (existingUser.length > 0) {
      return NextResponse.json({ 
        error: 'Phone number already registered',
        code: 'PHONE_EXISTS'
      }, { status: 400 });
    }

    // Hash the password
    const passwordHash = await hashPassword(password);

    // Create new user
    const newUser = await db.insert(users)
      .values({
        phone: trimmedPhone,
        name: trimmedName,
        passwordHash,
        createdAt: BigInt(Date.now())
      })
      .returning();

    const user = newUser[0];

    // Generate token
    const token = await generateToken(user);

    // Return success response with user data and token
    return NextResponse.json({
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name
      },
      token
    }, { status: 201 });

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}