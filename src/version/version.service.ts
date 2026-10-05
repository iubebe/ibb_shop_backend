import { readFileSync } from 'node:fs';
import { Injectable } from '@nestjs/common';

export interface VersionInfo {
  name: string;
  version: string;
  commit: string;
  builtAt: string;
}

/** Same relative path works from src/version (tests) and dist/version (build). */
const pkg = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as { name: string; version: string };

@Injectable()
export class VersionService {
  /** `GIT_COMMIT` and `BUILD_TIME` are injected as env at image build time. */
  get(): VersionInfo {
    return {
      name: pkg.name,
      version: pkg.version,
      commit: process.env.GIT_COMMIT ?? 'unknown',
      builtAt: process.env.BUILD_TIME ?? 'unknown',
    };
  }
}
