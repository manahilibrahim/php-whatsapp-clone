import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyPassword, generateToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { phone, password } = await request.json();

    // Validate required fields
    if (!phone || !password) {
      return NextResponse.json({ 
        error: 'Phone and password are required',
        code: 'MISSING_CREDENTIALS'
      }, { status: 400 });
    }

    // Find user by phone
    const user = await db.select()
      .from(users)
      .where(eq(users.phone, phone))
      .limit(1);

    if (user.length === 0) {
      return NextResponse.json({ 
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      }, { status: 401 });
    }

    const foundUser = user[0];

    // Verify password using auth utility
    const isValidPassword = await verifyPassword(password, foundUser.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json({ 
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      }, { status: 401 });
    }

    // Generate token using auth utility
    const token = generateToken(foundUser);

    // Return user data and token
    return NextResponse.json({
      user: {
        id: foundUser.id,
        phone: foundUser.phone,
        name: foundUser.name
      },
      token
    }, { status: 200 });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}