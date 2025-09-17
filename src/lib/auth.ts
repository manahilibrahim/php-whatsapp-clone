import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { NextRequest } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const SALT_ROUNDS = 10;

export interface AuthUser {
  id: number;
  phone: string;
  name: string;
  createdAt: bigint;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export function generateToken(user: { id: number }): string {
  return jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token: string): { userId: number } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    return decoded;
  } catch (error) {
    return null;
  }
}

export async function getCurrentUser(request: NextRequest): Promise<AuthUser | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (!decoded) {
      return null;
    }

    const user = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);
    if (user.length === 0) {
      return null;
    }

    return {
      id: user[0].id,
      phone: user[0].phone,
      name: user[0].name,
      createdAt: user[0].createdAt
    };
  } catch (error) {
    return null;
  }
}

export function requireAuth(user: AuthUser | null) {
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}