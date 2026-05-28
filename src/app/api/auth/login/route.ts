import { NextResponse } from 'next/server';
import { getAdminPassword } from '@/lib/redis';
import { setSessionCookie } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    const correctPassword = await getAdminPassword();

    if (password === correctPassword) {
      await setSessionCookie();
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
