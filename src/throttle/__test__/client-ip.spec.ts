import { clientIpFromHandshake } from '../client-ip.js';

describe('clientIpFromHandshake', () => {
  it('uses the socket address when no proxy is trusted', () => {
    expect(clientIpFromHandshake('1.1.1.1', '9.9.9.9', 0)).toBe('1.1.1.1');
  });

  it('takes the last forwarded entry behind one proxy', () => {
    // client-supplied junk on the left must be ignored
    expect(clientIpFromHandshake('10.0.0.1', '6.6.6.6, 2.2.2.2', 1)).toBe(
      '2.2.2.2',
    );
  });

  it('walks back over two proxies', () => {
    expect(clientIpFromHandshake('10.0.0.2', '2.2.2.2, 10.0.0.1', 2)).toBe(
      '2.2.2.2',
    );
  });

  it('falls back to the socket address when the header is missing', () => {
    expect(clientIpFromHandshake('10.0.0.1', undefined, 1)).toBe('10.0.0.1');
    expect(clientIpFromHandshake(undefined, undefined, 0)).toBe('unknown');
  });
});
