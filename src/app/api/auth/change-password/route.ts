import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getAdminPassword, setAdminPassword } from '@/lib/redis';

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { oldPassword, newPassword } = await request.json();
    const currentPassword = await getAdminPassword();

    if (oldPassword !== currentPassword) {
      return NextResponse.json({ error: 'Invalid old password' }, { status: 400 });
    }

    await setAdminPassword(newPassword);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
