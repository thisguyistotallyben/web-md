import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { renameItem } from '@/lib/notes';

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { oldPath, newName } = await request.json();
    if (!oldPath || !newName) {
      return NextResponse.json({ error: 'oldPath and newName are required' }, { status: 400 });
    }

    await renameItem(oldPath, newName);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
