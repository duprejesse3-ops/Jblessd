#!/bin/sh
# Export the multinicheai.com storefront as a Linux container image tar file, for
# machines that cannot pull from a registry.
#
#   container/save.sh                          # dist/jblessd-store-dev-linux-amd64.tar
#   container/save.sh 1.4.0                    # ...-1.4.0-linux-amd64.tar
#   container/save.sh --gzip 1.4.0             # ...-1.4.0-linux-amd64.tar.gz
#   container/save.sh --platform linux/arm64 1.4.0
#   container/save.sh --pull 1.4               # save the published tag, build nothing
#   container/save.sh --oci 1.4.0              # OCI archive instead of docker-archive
#   container/save.sh --output /tmp/store.tar 1.4.0
#
# The result loads on the target with either runtime and needs no network:
#
#   docker load -i jblessd-store-1.4.0-linux-amd64.tar
#   podman load -i jblessd-store-1.4.0-linux-amd64.tar
#
# This is the offline sibling of container/image.sh. That script builds for the
# host and pushes to a registry; this one produces a single file to copy to an
# air-gapped host, a customer's server, or a USB stick. The image reference
# baked into the archive is the same one image.sh would push, so a stack that
# already sets APP_IMAGE=ghcr.io/<owner>/jblessd-store:1.4 works unchanged after
# a `load` — nothing has to be retagged.
#
# The platform is always linux/*: the Dockerfile is built on node:24-alpine, so
# there is no other target. It defaults to linux/amd64 rather than to the host,
# because the artifact exists to be carried to a server and that server is
# almost always amd64. Say --platform linux/arm64 for the other one.

set -eu

cd "$(dirname "$0")/.."

IMAGE_NAME=${IMAGE_NAME:-jblessd-store}
PLATFORM=${PLATFORM:-linux/amd64}
OUTPUT_DIR=${OUTPUT_DIR:-dist}
FORMAT=docker-archive
GZIP=${GZIP:-}
PULL_ONLY=
OUTPUT=

while [ $# -gt 0 ]; do
  case "$1" in
    --gzip|-z) GZIP=1 ;;
    --oci) FORMAT=oci-archive ;;
    --pull) PULL_ONLY=1 ;;
    --platform) [ $# -ge 2 ] || { echo "error: --platform needs a value" >&2; exit 2; }
                PLATFORM=$2; shift ;;
    --output|-o) [ $# -ge 2 ] || { echo "error: --output needs a path" >&2; exit 2; }
                OUTPUT=$2; shift ;;
    -h|--help)
      sed -n '2,28p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    -*) echo "error: unknown option $1" >&2; exit 2 ;;
    *) break ;;
  esac
  shift
done

VERSION=${1:-dev}
VERSION=${VERSION#v}

# `arm64` and `linux/arm64` mean the same thing to a person; only one of them
# means anything to the build. Reject a non-Linux target outright rather than
# letting the engine fail several minutes into a build it can never finish.
case "$PLATFORM" in
  linux/*) ;;
  */*) echo "error: platform '$PLATFORM' is not linux; this image has no other target" >&2; exit 2 ;;
  *) PLATFORM="linux/$PLATFORM" ;;
esac
ARCH=${PLATFORM#linux/}

# The reference to bake into the archive comes from image.sh, which needs no
# engine to answer and already derives the GHCR owner from `git remote origin`.
# Asking it means the loaded image is named exactly what a registry pull would
# have produced, and there is one copy of that rule rather than two. Only the
# first tag is used: `docker save` records every tag an image carries, and the
# moving aliases (1.4, 1, latest) are registry conveniences that would make a
# file whose name says 1.4.0 load as `latest` too.
IMAGE_REF=$(IMAGE_NAME="$IMAGE_NAME" sh container/image.sh --url "$VERSION" | head -1)

# --pull fetches that reference from a registry, which a local-only name has no
# way to answer. Caught here rather than left to the engine, whose own error for
# this ("pinging container registry localhost") does not suggest the fix.
if [ -n "$PULL_ONLY" ]; then
  case "$IMAGE_REF" in
    localhost/*)
      echo "error: --pull needs a published image, but the reference is '$IMAGE_REF'." >&2
      echo "       This checkout has no GitHub 'origin' remote to derive one from." >&2
      echo "       Set IMAGE_REPO=ghcr.io/<owner>/$IMAGE_NAME, or drop --pull to" >&2
      echo "       build the image here instead." >&2
      exit 2 ;;
  esac
fi

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

# Probed once, here, rather than at the build below, so that an archive format
# this engine cannot write is refused in a second instead of after a full build.
HAS_BUILDX=
[ "$ENGINE" = docker ] && docker buildx version >/dev/null 2>&1 && HAS_BUILDX=1

# Only podman's `save` and buildx's `oci` exporter write an OCI archive; plain
# `docker save` has one format and no flag to change it.
if [ "$FORMAT" = oci-archive ] && [ "$ENGINE" != podman ] && { [ -z "$HAS_BUILDX" ] || [ -n "$PULL_ONLY" ]; }; then
  echo "error: --oci needs podman, or docker with buildx and without --pull;" >&2
  echo "       'docker save' writes docker-archive only. Drop --oci — both" >&2
  echo "       runtimes load a docker-archive." >&2
  exit 2
fi

# Emulation is the usual reason a cross-architecture build appears to hang, so
# name it up front. Docker Desktop ships the binfmt handlers; a bare Linux host
# needs them installed, and on Podman the package is qemu-user-static.
host_arch=$(uname -m)
case "$host_arch" in
  x86_64|amd64) host_arch=amd64 ;;
  aarch64|arm64) host_arch=arm64 ;;
esac
if [ -z "$PULL_ONLY" ] && [ "$host_arch" != "$ARCH" ]; then
  echo "note: building $PLATFORM on $host_arch — this runs under QEMU and is slow." >&2
  echo "      'exec format error' means the binfmt handlers are missing:" >&2
  echo "      docker run --privileged --rm tonistiigi/binfmt --install all" >&2
fi

# A .tar name is deliberate: it is what `docker load -i` expects and what the
# --gzip step appends to. The name carries version and architecture because the
# one thing a loose image file loses is which of those it is.
safe_version=$(printf '%s' "$VERSION" | tr '/:' '--')
TAR=${OUTPUT:-$OUTPUT_DIR/$IMAGE_NAME-$safe_version-linux-$ARCH.tar}

# --output may name the compressed file, which is the natural thing to type. The
# engine still has to write the plain .tar that gzip then consumes, so take the
# suffix as the request it is and strip it back to that name.
case "$TAR" in
  *.tar.gz) TAR=${TAR%.gz}; GZIP=1 ;;
  *.tgz) TAR="${TAR%.tgz}.tar"; GZIP=1 ;;
  *.gz) TAR=${TAR%.gz}; GZIP=1 ;;
esac
mkdir -p "$(dirname "$TAR")"

revision=$(git rev-parse HEAD 2>/dev/null || echo unknown)
created=$(date -u +%Y-%m-%dT%H:%M:%SZ)

if [ -z "$PULL_ONLY" ] && [ "$VERSION" != "dev" ] && [ -n "$(git status --porcelain 2>/dev/null || true)" ]; then
  echo "warning: working tree is dirty; :$VERSION will not match commit $revision" >&2
fi

echo "Exporting $IMAGE_REF ($PLATFORM) with $ENGINE"
echo "  -> $TAR${GZIP:+.gz}"

# Three paths, in order of preference.
#
# buildx writes the archive itself, in one step. That matters beyond tidiness:
# it never loads the image into the local daemon, so exporting an amd64 tar from
# an arm64 laptop does not leave a foreign-architecture image behind that later
# `docker run`s pick up by accident.
#
# Plain `docker build` + `docker save` is the fallback for a daemon without
# buildx. Podman takes the same shape but can also write an OCI archive, which
# `docker save` cannot.
if [ -n "$PULL_ONLY" ]; then
  # For an air-gapped copy of something already published: fetch the exact bytes
  # from the registry rather than rebuilding them, so the digest on the target
  # matches the release.
  "$ENGINE" pull --platform "$PLATFORM" "$IMAGE_REF"
  if [ "$ENGINE" = podman ]; then
    podman save --format "$FORMAT" --output "$TAR" "$IMAGE_REF"
  else
    docker save --output "$TAR" "$IMAGE_REF"
  fi
elif [ -n "$HAS_BUILDX" ]; then
  exporter=docker
  [ "$FORMAT" = oci-archive ] && exporter=oci
  docker buildx build \
    --platform "$PLATFORM" \
    --file container/Dockerfile \
    --build-arg IMAGE_VERSION="$VERSION" \
    --build-arg IMAGE_REVISION="$revision" \
    --build-arg IMAGE_CREATED="$created" \
    --tag "$IMAGE_REF" \
    --output "type=$exporter,dest=$TAR" \
    .
else
  "$ENGINE" build \
    --platform "$PLATFORM" \
    --file container/Dockerfile \
    --build-arg IMAGE_VERSION="$VERSION" \
    --build-arg IMAGE_REVISION="$revision" \
    --build-arg IMAGE_CREATED="$created" \
    --tag "$IMAGE_REF" \
    .

  if [ "$ENGINE" = podman ]; then
    podman save --format "$FORMAT" --output "$TAR" "$IMAGE_REF"
  else
    docker save --output "$TAR" "$IMAGE_REF"
  fi
fi

# Layers inside a docker-archive are stored uncompressed, so this is not the
# no-op that gzipping an already-compressed artifact would be — it typically
# halves the file. Both runtimes read a gzipped archive directly, so the target
# does not have to unpack it first.
if [ -n "$GZIP" ]; then
  gzip -f "$TAR"
  TAR="$TAR.gz"
fi

# A checksum in `sha256sum -c` format, beside the archive and naming only the
# basename, so verifying on the target is `cd` there and one command. This is
# the only integrity check a file that travelled by USB stick gets.
if command -v sha256sum >/dev/null 2>&1; then
  (cd "$(dirname "$TAR")" && sha256sum "$(basename "$TAR")" > "$(basename "$TAR").sha256")
elif command -v shasum >/dev/null 2>&1; then
  (cd "$(dirname "$TAR")" && shasum -a 256 "$(basename "$TAR")" > "$(basename "$TAR").sha256")
fi

size=$(ls -lh "$TAR" | awk '{print $5}')

cat <<EOF

Wrote $TAR ($size)
$( [ -f "$TAR.sha256" ] && echo "      $TAR.sha256" )

On the Linux target:

  sha256sum -c $(basename "$TAR").sha256
  docker load -i $(basename "$TAR")      # or: podman load -i ...

That loads $IMAGE_REF. Run it with a Postgres and a blobs volume — see
container/README.md, or point the compose stack at it:

  APP_IMAGE=$IMAGE_REF docker compose -f container/docker-compose.yml up
EOF
