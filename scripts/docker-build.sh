#!/usr/bin/env bash
# Build the image tagged with the package.json version (+ :latest).
# Usage: scripts/docker-build.sh [image-name]   (default: ibb_shop_backend)
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

IMAGE="${1:-ibb_shop_backend}"
VERSION="$(node -p "require('./package.json').version")"

docker build \
  --build-arg GIT_COMMIT="$(git rev-parse --short HEAD)" \
  --build-arg BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  -t "$IMAGE:$VERSION" -t "$IMAGE:latest" .

echo "Built $IMAGE:$VERSION"
