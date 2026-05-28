import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { listTrash } from '@/lib/notes';

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const items = await listTrash();
    return NextResponse.json(items);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
