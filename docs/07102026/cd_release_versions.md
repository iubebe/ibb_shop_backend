# CD: version-bump PRs to ibb_shop_release

Date: 07/10/2026 (rewrites the same-day direct-push version)

## Done

- `release.yml`: the `deploy` job (pushed straight to the release repo's `main`) is replaced by `request-prod-deploy`. After release-please creates a release and the image is pushed, it runs `gh workflow run bump-version.yml -R iubebe/ibb_shop_release -f service=backend -f version=<X.Y.Z> -f environment=prod`.
- New `staging.yml`: on every push to `develop`, builds and pushes `ghcr.io/iubebe/ibb_shop_backend:dev-<sha7>`, then requests the same PR for `environment=staging`. Only the newest develop run is kept (`cancel-in-progress`).
- The release repo's `bump-version.yml` opens or updates the PR `bump/<env>/backend`; see `ibb_shop_release/docs/07102026/version_bump_prs.md`.

## Decisions

- CI no longer has write access to deployment config: the token can only start a workflow. Devops merge the PR = deploy decision.
- Staging deploys from develop builds (`dev-<sha>`), prod from release tags; prod rebuilds from the tag, so the prod image is not byte-identical to the one tested on staging.

## Pending

- Secret `RELEASE_REPO_TOKEN` (fine-grained PAT, `iubebe/ibb_shop_release` only, Actions read/write). Replaces the earlier Contents-write PAT; revoke that one if created.
- Not run; first runs are the next push to `develop` and the next release.
- Same two jobs to copy to guest, sms and pos (change `service=`).
