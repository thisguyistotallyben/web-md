import crypto from 'node:crypto';
import { cookies } from 'next/headers';

const SECRET = process.env.JWT_SECRET || 'fallback-secret-web-md-token';
const COOKIE_NAME = 'web_md_session';
const SESSION_DURATION = 1000 * 60 * 60 * 24 * 7; // 7 days

// Helper to base64url encode
function base64url(str: string): string {
  return Buffer.from(str).toString('base64url');
}

// Helper to base64url decode
function base64urlDecode(str: string): string {
  return Buffer.from(str, 'base64url').toString('utf8');
}

// Generate HMAC signature
function signPayload(payloadStr: string): string {
  return crypto
    .createHmac('sha256', SECRET)
    .update(payloadStr)
    .digest('base64url');
}

export function createSessionToken(): string {
  const expires = Date.now() + SESSION_DURATION;
  const payload = JSON.stringify({ expires });
  const encodedPayload = base64url(payload);
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [encodedPayload, signature] = parts;
  const expectedSignature = signPayload(encodedPayload);

  if (signature !== expectedSignature) return false;

  try {
    const payload = JSON.parse(base64urlDecode(encodedPayload));
    if (Date.now() > payload.expires) {
      return false; // Expired
    }
    return true;
  } catch {
    return false;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export async function setSessionCookie() {
  const token = createSessionToken();
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
