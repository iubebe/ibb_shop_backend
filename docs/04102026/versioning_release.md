# Versioning and releases

> Update: the local `release-it` flow described below was replaced by release-please the same day. See `release_please.md`. The SemVer, `/api/version` and Docker parts still apply.

Date: 04/10/2026

## Decisions
- SemVer in `package.json` is the single source of truth. Versions are derived from Conventional Commits (`feat` = minor, `fix` = patch, `feat!`/`BREAKING CHANGE` = major). History already follows this style.
- `release-it` + `@release-it/conventional-changelog` (config: `.release-it.json`): bumps the version, updates `CHANGELOG.md`, commits `chore(release): vX.Y.Z` and tags `vX.Y.Z`. Allowed on `main` and `develop`, requires a clean tree, runs lint and tests first.
- `git.push` is off on purpose: pushing tags is outward-facing, so push manually (`git push --follow-tags`). No npm publish, no GitHub release.
- `GET /api/version` (`src/version/`) returns name, version, commit and build time.
- `Dockerfile` (multi-stage, runs as `node`) takes `GIT_COMMIT` and `BUILD_TIME` build args. `scripts/docker-build.sh` tags the image with the package version and `latest`.

## How to release
1. Clean tree on `main` (or `develop`).
2. `pnpm release:dry` to preview version bump and changelog, then `pnpm release`.
3. `git push --follow-tags`.
4. `pnpm docker:build`, then push `ibb_shop_backend:<version>` to the registry and bump it in `ibb_shop_release`.

## Verified
- Dry run proposes 0.0.1 -> 0.1.0 with the changelog from existing commits.
- The built image runs and `/api/version` returns the version.

## Pending
- No release has been cut yet (version is still 0.0.1, no tag, no `CHANGELOG.md`).
- Registry / image name for `ibb_shop_release` is not decided; the script builds a local image only.
- Optional: commitlint + husky to enforce Conventional Commits.
- Optional: CI to run the release and build.
