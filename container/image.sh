#!/bin/sh
# Build — and optionally publish — the multinicheai.com container image.
#
#   container/image.sh                    # build, tag :dev and :sha-<short>
#   container/image.sh 1.4.0              # build, tag :1.4.0 :1.4 :1 :latest
#   PUSH=1 container/image.sh 1.4.0       # ...and push every tag
#   IMAGE_REPO=ghcr.io/me/store PUSH=1 container/image.sh 1.4.0
#   container/image.sh --url              # print the image URLs, build nothing
#   container/image.sh --url 1.4.0        # ...for that release's tags
#
# Works with either Docker or Podman; `build` and `push` take the same flags in
# both. CONTAINER_ENGINE=podman forces the choice on a machine that has both.
#
# The build context is the repository root, not container/, because the image
# needs the application source that lives above this directory. The script cd's
# there itself so it works from anywhere.
#
# This builds for the host architecture only. The multi-arch (amd64 + arm64)
# images come from .github/workflows/container-image.yml, which has buildx and
# QEMU available; reproducing that here would mean every contributor needs an
# emulation setup to publish.

set -eu

cd "$(dirname "$0")/.."

IMAGE_NAME=${IMAGE_NAME:-jblessd-store}

# `--url` answers "what do I pull?" without a Docker daemon. That is the
# question a deploy target actually asks, and a full build is a slow and
# machine-specific way to answer it. It reuses the tag derivation below rather
# than restating the URLs, so what it prints is exactly what a build publishes.
URL_ONLY=
if [ "${1:-}" = "--url" ]; then
  URL_ONLY=1
  shift
fi

VERSION=${1:-dev}
VERSION=${VERSION#v}

# Default destination is the GHCR namespace of whoever owns `origin`, so a fork
# publishes under its own account without editing this file. With no GitHub
# remote the name is `localhost/<name>`, which is right for a purely local build:
# Podman refuses to resolve an unqualified name and would otherwise look the
# image up on Docker Hub, and the PUSH guard below rejects `localhost/` outright
# so an accidental publish still fails loudly instead of reaching a registry.
if [ -z "${IMAGE_REPO:-}" ]; then
  origin=$(git config --get remote.origin.url 2>/dev/null || true)
  case "$origin" in
    *github.com[:/]*)
      owner=$(printf '%s' "$origin" | sed -e 's#.*github\.com[:/]##' -e 's#/.*##' | tr '[:upper:]' '[:lower:]')
      IMAGE_REPO="ghcr.io/$owner/$IMAGE_NAME"
      ;;
    *)
      IMAGE_REPO="localhost/$IMAGE_NAME"
      ;;
  esac
fi

revision=$(git rev-parse HEAD 2>/dev/null || echo unknown)
created=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# A release tag names a commit, so building one from a dirty tree produces an
# image whose recorded revision does not describe its contents. Worth a warning,
# not a refusal — reproducing a customer's build often means exactly this.
if [ -z "$URL_ONLY" ] && [ "$VERSION" != "dev" ] && [ -n "$(git status --porcelain 2>/dev/null || true)" ]; then
  echo "warning: working tree is dirty; :$VERSION will not match commit $revision" >&2
fi

# Semver gets the usual moving aliases: 1.4.0 also publishes 1.4, 1 and latest,
# so a deployment can subscribe to whichever level of churn it tolerates.
tags="$VERSION"
case "$VERSION" in
  [0-9]*.[0-9]*.[0-9]*)
    major=${VERSION%%.*}
    rest=${VERSION#*.}
    minor=${rest%%.*}
    tags="$tags $major.$minor $major latest"
    ;;
  dev)
    short=$(git rev-parse --short HEAD 2>/dev/null || true)
    [ -n "$short" ] && tags="$tags sha-$short"
    ;;
esac

# One URL per line, on stdout and nothing else, so it composes:
#   APP_IMAGE=$(container/image.sh --url 1.4.0 | head -1) docker compose ... pull
if [ -n "$URL_ONLY" ]; then
  for tag in $tags; do
    echo "$IMAGE_REPO:$tag"
  done
  exit 0
fi

# Resolved after `--url` has had its chance to exit, so printing a URL still
# needs no engine installed at all. Docker wins a tie: a machine with both is
# usually a Docker machine that also has Podman, and the reverse case is the one
# people set CONTAINER_ENGINE for.
ENGINE=${CONTAINER_ENGINE:-}
if [ -z "$ENGINE" ]; then
  if command -v docker >/dev/null 2>&1; then
    ENGINE=docker
  elif command -v podman >/dev/null 2>&1; then
    ENGINE=podman
  else
    echo "error: neither docker nor podman on PATH; set CONTAINER_ENGINE" >&2
    exit 1
  fi
fi

tag_args=""
for tag in $tags; do
  tag_args="$tag_args --tag $IMAGE_REPO:$tag"
done

# Checked before the build rather than after it, so a missing registry costs a
# second instead of a full image. `localhost/` is caught separately: it has the
# shape of a registry reference but names only this machine's image store.
if [ "${PUSH:-}" = "1" ]; then
  case "$IMAGE_REPO" in
    localhost/*)
      echo "error: IMAGE_REPO='$IMAGE_REPO' is a local-only name; refusing to push" >&2
      echo "       Set IMAGE_REPO=ghcr.io/<owner>/$IMAGE_NAME, or add a GitHub" >&2
      echo "       'origin' remote so it is derived automatically." >&2
      exit 1 ;;
    */*) ;;
    *) echo "error: IMAGE_REPO='$IMAGE_REPO' has no registry; refusing to push" >&2; exit 1 ;;
  esac
fi

echo "Building $IMAGE_REPO with $ENGINE"
for tag in $tags; do echo "  :$tag"; done

# shellcheck disable=SC2086  # tag_args is a deliberately word-split list
"$ENGINE" build \
  --file container/Dockerfile \
  --build-arg IMAGE_VERSION="$VERSION" \
  --build-arg IMAGE_REVISION="$revision" \
  --build-arg IMAGE_CREATED="$created" \
  $tag_args \
  .

if [ "${PUSH:-}" = "1" ]; then
  for tag in $tags; do
    echo "Pushing $IMAGE_REPO:$tag"
    "$ENGINE" push "$IMAGE_REPO:$tag"
  done
else
  echo "Not pushed. Re-run with PUSH=1 to publish."
fi
