import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { restoreItem } from '@/lib/notes';

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { path: trashPath } = await request.json();
    if (!trashPath) {
      return NextResponse.json({ error: 'path is required' }, { status: 400 });
    }

    await restoreItem(trashPath);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
