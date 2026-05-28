import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getThemeSetting, setThemeSetting } from '@/lib/redis';

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const settings = await getThemeSetting();
    return NextResponse.json(JSON.parse(settings));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const settingsJson = JSON.stringify(body, null, 2);
    await setThemeSetting(settingsJson);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
