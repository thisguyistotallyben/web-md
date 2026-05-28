import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { readNote } from '@/lib/notes';

export async function GET(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const notePath = searchParams.get('path');

  if (!notePath) {
    return NextResponse.json({ error: 'Note path is required' }, { status: 400 });
  }

  try {
    const content = await readNote(notePath);
    return NextResponse.json({ content });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
