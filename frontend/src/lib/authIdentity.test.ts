import { describe, expect, it } from 'vitest';

import { isValidEmail, nameFromEmail, normaliseEmail } from './authIdentity';

describe('auth identity helpers', () => {
  it('normalises email addresses', () => {
    expect(normaliseEmail('  Dave@Example.COM ')).toBe('dave@example.com');
  });

  it('validates practical email addresses', () => {
    expect(isValidEmail('dave@example.com')).toBe(true);
    expect(isValidEmail('dave.smith+app@example.co.uk')).toBe(true);
    expect(isValidEmail('dave')).toBe(false);
    expect(isValidEmail('dave@')).toBe(false);
    expect(isValidEmail('dave@example')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });

  it('builds a friendly name from the email local-part', () => {
    expect(nameFromEmail('dave.smith@example.com')).toBe('Dave Smith');
    expect(nameFromEmail('dave+app@example.com')).toBe('Dave');
    expect(nameFromEmail('DAVE_lee@example.com')).toBe('Dave Lee');
    expect(nameFromEmail('123@example.com')).toBe('123');
  });
});
