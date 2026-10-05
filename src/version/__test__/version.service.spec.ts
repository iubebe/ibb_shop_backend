import { readFileSync } from 'node:fs';
import { VersionService } from '../version.service.js';

const pkg = JSON.parse(
  readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'),
) as { name: string; version: string };

describe('VersionService', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('reports the package.json name and version', () => {
    expect(new VersionService().get()).toMatchObject({
      name: pkg.name,
      version: pkg.version,
    });
  });

  it('reads commit and build time from env', () => {
    vi.stubEnv('GIT_COMMIT', 'abc1234');
    vi.stubEnv('BUILD_TIME', '2026-10-04T00:00:00Z');
    expect(new VersionService().get()).toMatchObject({
      commit: 'abc1234',
      builtAt: '2026-10-04T00:00:00Z',
    });
  });

  it('falls back to "unknown" outside a built image', () => {
    vi.stubEnv('GIT_COMMIT', undefined);
    vi.stubEnv('BUILD_TIME', undefined);
    expect(new VersionService().get()).toMatchObject({
      commit: 'unknown',
      builtAt: 'unknown',
    });
  });
});
