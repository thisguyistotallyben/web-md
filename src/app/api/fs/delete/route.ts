import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { deleteItem } from '@/lib/notes';

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { path: targetPath } = await request.json();
    if (!targetPath) {
      return NextResponse.json({ error: 'path is required' }, { status: 400 });
    }

    await deleteItem(targetPath);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
