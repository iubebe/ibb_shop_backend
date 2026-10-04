import { CsrfService } from '../csrf.service.js';
import { authConfig } from './helpers.js';

describe('CsrfService', () => {
  const csrf = new CsrfService(authConfig);

  it('accepts a generated token echoed back in the header', () => {
    const token = csrf.generate();
    expect(csrf.validate(token, token)).toBe(true);
  });

  it('rejects missing or mismatching values', () => {
    const token = csrf.generate();
    expect(csrf.validate(undefined, token)).toBe(false);
    expect(csrf.validate(token, undefined)).toBe(false);
    expect(csrf.validate(token, csrf.generate())).toBe(false);
  });

  it('rejects a planted cookie that was not signed by the server', () => {
    expect(csrf.validate('abc.def', 'abc.def')).toBe(false);
    expect(csrf.validate('abc', 'abc')).toBe(false);
  });

  it('rejects tokens signed with another secret', () => {
    const other = new CsrfService({
      ...authConfig,
      csrfSecret: 'z'.repeat(40),
    });
    const token = other.generate();
    expect(csrf.validate(token, token)).toBe(false);
  });
});
