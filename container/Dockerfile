# Storefront container.
#
# Runs the application source unmodified — no build step, no bundler, no
# transpile. Node strips the TypeScript annotations from the .mts and .ts files
# at load time, and container/hooks redirects the @netlify/* imports to the
# local adapters. What is in the repository is what runs.
#
# Node 24 is pinned deliberately: native type stripping needs 22.6 or newer, and
# pinning the major avoids a future default flipping under the image.
#
# The registry is spelled out rather than left as `node:24-alpine`. Docker
# assumes Docker Hub for a bare name; Podman deliberately does not, and on a
# non-interactive build it fails outright rather than guessing. Fully qualified
# means the same image under both.

FROM docker.io/library/node:24-alpine

# tini reaps zombies and forwards SIGTERM to Node, so the graceful shutdown in
# server.mjs actually runs when the container is stopped.
RUN apk add --no-cache tini

WORKDIR /app

# Dependencies first, so a source-only change does not invalidate the install
# layer. Two manifests: the application's (Stripe, Anthropic) and the
# container's (pg). Node resolves upward from the importing file, so the
# adapters find /app/container/node_modules and the app finds /app/node_modules.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY container/package.json container/package-lock.json* ./container/
RUN cd container && npm install --omit=dev --no-audit --no-fund && npm cache clean --force

# Application source. .dockerignore keeps node_modules, .git and build output out.
COPY netlify ./netlify
COPY container ./container
COPY netlify.toml package.json ./
COPY index.html admin.html agent.html manifest.webmanifest robots.txt sw.js favicon.ico ./
COPY *.js *.png *.xml *.txt ./
COPY icons ./icons
COPY privacy-policy ./privacy-policy
COPY terms ./terms
COPY refund-policy ./refund-policy
COPY .well-known ./.well-known

# Blob storage lives on a volume; the node user must own it to write there.
RUN mkdir -p /data/blobs && chown -R node:node /data

ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    BLOBS_DIR=/data/blobs

# Image identity. Declared here, at the end, so that stamping a new revision
# invalidates only the metadata layer and not the npm install above. The values
# are supplied by container/image.sh or by the publish workflow; a plain
# `docker build` with no --build-arg still produces a valid, if undated, image.
ARG IMAGE_VERSION=dev
ARG IMAGE_REVISION=unknown
ARG IMAGE_CREATED=1970-01-01T00:00:00Z

LABEL org.opencontainers.image.title="multinicheai.com storefront" \
      org.opencontainers.image.description="The multinicheai.com storefront running on plain Node, without Netlify" \
      org.opencontainers.image.url="https://multinicheai.com" \
      org.opencontainers.image.vendor="multinicheai.com" \
      org.opencontainers.image.licenses="UNLICENSED" \
      org.opencontainers.image.version="${IMAGE_VERSION}" \
      org.opencontainers.image.revision="${IMAGE_REVISION}" \
      org.opencontainers.image.created="${IMAGE_CREATED}"

USER node
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "--import", "./container/hooks/register.mjs", "container/server.mjs"]
