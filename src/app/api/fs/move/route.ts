import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { moveItem } from '@/lib/notes';

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { sourcePath, targetParentPath } = await request.json();
    // Allow empty targetParentPath since it means root
    if (!sourcePath && sourcePath !== '') {
      return NextResponse.json({ error: 'sourcePath is required' }, { status: 400 });
    }

    await moveItem(sourcePath, targetParentPath);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
