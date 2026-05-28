import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { writeNote } from '@/lib/notes';

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { path: notePath, content } = await request.json();
    if (!notePath) {
      return NextResponse.json({ error: 'Note path is required' }, { status: 400 });
    }

    await writeNote(notePath, content || '');
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
