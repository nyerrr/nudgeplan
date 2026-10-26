/** Small pure helpers shared by the auth adapter and its tests. */

export function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  const email = normaliseEmail(value);
  if (email.length < 5 || email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/**
 * Turn an email local-part into a friendly first name.
 * dave.smith+app@example.com -> "Dave Smith"
 */
export function nameFromEmail(value: string): string {
  const local = normaliseEmail(value).split('@')[0]?.split('+')[0] ?? '';
  const words = local
    .replace(/[._-]+/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!words.length) return '';
  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .slice(0, 24);
}
