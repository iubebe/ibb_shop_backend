# Automated releases with release-please

Date: 04/10/2026

## Decision
Replaced `release-it` (manual `pnpm release`) with release-please: a human-reviewed Release PR drives tags and the changelog. Chosen because it keeps an approval step and works with protected branches.

## How it works
- `.github/workflows/release.yml` runs on every push to `main`.
- release-please reads Conventional Commits since the last release and opens/updates a "Release PR" with the version bump in `package.json` and the `CHANGELOG.md` entry. Config: `release-please-config.json`; current version: `.release-please-manifest.json` (seeded at 0.0.1).
- Merging the Release PR creates the git tag `vX.Y.Z` and a GitHub release.
- The `image` job in the same workflow then builds the Dockerfile and pushes `ghcr.io/<owner>/ibb_shop_backend:<version>` and `:latest` (GitHub Container Registry, authenticated with `GITHUB_TOKEN`). It lives in the same workflow because tags made with `GITHUB_TOKEN` don't trigger other workflows.
- Bumps: `feat` = minor, `fix` = patch, `feat!` / `BREAKING CHANGE` = major; while below 1.0, breaking changes bump minor (`bump-minor-pre-major`).
- Removed: `release-it` and its changelog plugin, `.release-it.json`, the `release` and `release:dry` scripts. `docker:build` stays for local builds.

## Needed on GitHub (not done here)
- Repo setting: Settings > Actions > General > "Allow GitHub Actions to create and approve pull requests".
- Work lands on `main` via PR from `develop`; releases only come from `main`.
- Package visibility on ghcr.io is private by default; consumers of `ibb_shop_release` need a pull token.

## Pending
- Workflow is untested: it needs to run on GitHub. Nothing has been pushed.
- Enforce Conventional Commits (commitlint + husky, or a PR-title check); a bad commit message is skipped or mis-bumped.
- Pin the ghcr image version in `ibb_shop_release` after the first release.
