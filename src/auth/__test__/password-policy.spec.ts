import { assertValidNewPassword } from '../password-policy.js';

describe('assertValidNewPassword', () => {
  it('accepts 10-128 characters', () => {
    expect(() => assertValidNewPassword('a'.repeat(10))).not.toThrow();
    expect(() => assertValidNewPassword('a'.repeat(128))).not.toThrow();
  });

  it('rejects too short or too long', () => {
    expect(() => assertValidNewPassword('a'.repeat(9))).toThrow();
    expect(() => assertValidNewPassword('a'.repeat(129))).toThrow();
  });
});
