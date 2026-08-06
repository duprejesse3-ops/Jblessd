# Storefront container.
#
# Runs the application source unmodified — no build step, no bundler, no
# transpile. Node strips the TypeScript annotations from the .mts and .ts files
# at load time, and container/hooks redirects the @netlify/* imports to the
# local adapters. What is in the repository is what runs.
#
# Node 24 is pinned deliberately: native type stripping needs 22.6 or newer, and
# pinning the major avoids a future default flipping under the image.

FROM node:24-alpine

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

USER node
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "--import", "./container/hooks/register.mjs", "container/server.mjs"]
