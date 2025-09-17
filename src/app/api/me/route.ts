import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    return NextResponse.json({ 
      user: { 
        id: user.id, 
        phone: user.phone, 
        name: user.name 
      } 
    }, { status: 200 });
    
  } catch (error) {
    console.error('GET current user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}