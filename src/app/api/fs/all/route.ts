import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { listAllFilesRecursive } from '@/lib/notes';

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const files = await listAllFilesRecursive();
    return NextResponse.json(files);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
