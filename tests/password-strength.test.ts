import { describe, it, expect } from 'vitest';
import { getPasswordStrength } from '../lib/password-strength';

describe('getPasswordStrength', () => {
  it('returns weak for short password', () => {
    expect(getPasswordStrength('abc')).toBe('weak');
  });
  it('returns very-strong for long complex password', () => {
    expect(getPasswordStrength('Str0ng!P@ssw0rd#2026')).toBe('very-strong');
  });
  it('returns strong for 16-char alpha-numeric', () => {
    expect(getPasswordStrength('abcdefgh12345678')).toBe('strong');
  });
  it('returns acceptable for medium password', () => {
    expect(getPasswordStrength('Pass1234')).toBe('acceptable');
  });
});
