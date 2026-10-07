# Keep develop up to date with main

Date: 07/10/2026

## Done

- `.github/workflows/sync-develop.yml`: on every push to `main`, merges `main` into `develop` (merge commit, no history rewrite) and pushes. If `develop` already contains `main`, it does nothing.
- If the merge conflicts or the push is rejected (branch protection), it merges nothing and opens (or reuses) a PR `main` -> `develop` for a person to resolve.

## Why develop drifted

`main` gets commits `develop` never sees: release-please's version bump and changelog, and the squash-merge commit of each develop PR.

## Notes

- Merge develop PRs into `main` with a **merge commit**, not squash. A squash gives main a commit that develop does not have, which makes later merges conflict-prone.
- The push uses the default token, so it does not trigger other workflows (e.g. `staging.yml` does not build for a sync commit). It also cannot push commits that change files under `.github/workflows/`; that case falls back to the PR.
- If develop is protected, allow GitHub Actions to push to it, or accept the PR fallback.
- Not run yet; first run is the next push to `main`.
