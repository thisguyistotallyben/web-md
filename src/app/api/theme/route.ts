import { NextResponse } from 'next/server';
import { getThemeSetting } from '@/lib/redis';

export async function GET() {
  try {
    const settings = await getThemeSetting();
    const parsed = JSON.parse(settings);
    return NextResponse.json({ theme: parsed.theme || 'dark' });
  } catch {
    return NextResponse.json({ theme: 'dark' });
  }
}
