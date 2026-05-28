import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ online: true, timestamp: Date.now() });
}
