import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://database.local:6379';
const DEFAULT_PASSWORD = process.env.SERMON_PASSWORD || 'admin';
const DEFAULT_THEME = 'dark';

let client: ReturnType<typeof createClient> | null = null;
let memoryStore: Record<string, string> = {};

async function getClient() {
  if (client) return client;

  try {
    const c = createClient({ url: REDIS_URL });
    c.on('error', (err) => console.log('[Redis] Client Error', err));
    await c.connect();
    console.log('[Redis] Connected successfully to', REDIS_URL);
    client = c;
    return client;
  } catch (err: any) {
    console.warn('[Redis] Connection failed. Using in-memory fallback settings:', err.message);
    client = null;
    return null;
  }
}

export async function getRedisValue(key: string, defaultValue: string): Promise<string> {
  const c = await getClient();
  if (c && c.isOpen) {
    try {
      const val = await c.get(key);
      if (val !== null) return val;
    } catch (err) {
      console.error('[Redis] Error fetching key:', key, err);
    }
  }
  return memoryStore[key] !== undefined ? memoryStore[key] : defaultValue;
}

export async function setRedisValue(key: string, value: string): Promise<void> {
  memoryStore[key] = value;
  const c = await getClient();
  if (c && c.isOpen) {
    try {
      await c.set(key, value);
    } catch (err) {
      console.error('[Redis] Error setting key:', key, err);
    }
  }
}

export async function getAdminPassword(): Promise<string> {
  return getRedisValue('web-md:config:password', DEFAULT_PASSWORD);
}

export async function setAdminPassword(password: string): Promise<void> {
  await setRedisValue('web-md:config:password', password);
}

export async function getThemeSetting(): Promise<string> {
  return getRedisValue('web-md:config:theme', JSON.stringify({ theme: DEFAULT_THEME }));
}

export async function setThemeSetting(settingsJson: string): Promise<void> {
  await setRedisValue('web-md:config:theme', settingsJson);
}
