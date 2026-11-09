import { randomBytes, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
const scryptOptions = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
export const token = () => randomBytes(32).toString('hex');
export const digest = (value) => createHash('sha256').update(value).digest('hex');
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 64, scryptOptions);
  return `${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password, encoded) {
  const [salt, expected] = (
    encoded ?? '00000000000000000000000000000000:' + '0'.repeat(128)
  ).split(':');
  const actual = await derive(password, salt, 64, scryptOptions);
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}
export function validateCredentials(username, password) {
  const invalid = (message) => {
    const error = new Error(message);
    error.status = 400;
    throw error;
  };
  if (typeof username !== 'string' || !/^[a-zA-Z0-9_]{3,20}$/.test(username))
    invalid('Use 3–20 letters, numbers, or underscores for your player name.');
  if (typeof password !== 'string' || password.length < 12 || password.length > 128)
    invalid('Use a password between 12 and 128 characters.');
}

export function createLimiter(limit, windowMs) {
  const entries = new Map();
  return (key) => {
    const now = Date.now();
    if (entries.size > 10000)
      for (const [k, v] of entries) if (v.reset <= now) entries.delete(k);
    let entry = entries.get(key);
    if (!entry || entry.reset <= now) {
      if (entries.size >= 20000 && !entry) return false;
      entry = { count: 0, reset: now + windowMs };
      entries.set(key, entry);
    }
    return ++entry.count <= limit;
  };
}
