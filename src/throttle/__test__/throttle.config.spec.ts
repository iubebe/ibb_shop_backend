import { ConfigService } from '@nestjs/config';
import { loadThrottleConfig } from '../throttle.config.js';

const load = (env: Record<string, unknown>) =>
  loadThrottleConfig(new ConfigService(env));

describe('loadThrottleConfig', () => {
  it('has generous defaults and is enabled', () => {
    const c = load({});
    expect(c.enabled).toBe(true);
    expect(c.trustProxyHops).toBe(0);
    expect(c.burst).toEqual({ limit: 50, ttlMs: 1000 });
    expect(c.sustained).toEqual({ limit: 600, ttlMs: 60_000 });
    expect(c.strict).toEqual({ limit: 10, ttlMs: 60_000, blockMs: 60_000 });
  });

  it('reads overrides and converts seconds to ms', () => {
    const c = load({
      THROTTLE_ENABLED: 'false',
      TRUST_PROXY: '2',
      THROTTLE_TTL: '30',
      THROTTLE_BLOCK_SECONDS: '5',
    });
    expect(c.enabled).toBe(false);
    expect(c.trustProxyHops).toBe(2);
    expect(c.sustained.ttlMs).toBe(30_000);
    expect(c.blockMs).toBe(5000);
  });

  it('rejects invalid numbers', () => {
    expect(() => load({ THROTTLE_LIMIT: 'abc' })).toThrow('THROTTLE_LIMIT');
    expect(() => load({ TRUST_PROXY: '-1' })).toThrow('TRUST_PROXY');
  });
});
