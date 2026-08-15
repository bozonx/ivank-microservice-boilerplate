# syntax=docker/dockerfile:1

# Node major version comes from .nvmrc via the build arg — do not hard-code it here.
ARG NODE_MAJOR=24

# --- Dependencies -----------------------------------------------------------
FROM node:${NODE_MAJOR}-bookworm-slim AS deps

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
  pnpm install --frozen-lockfile

# --- Build ------------------------------------------------------------------
FROM deps AS build

# Only what the compiler needs. Never COPY . . — it drags secrets into this layer.
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src

RUN pnpm build && pnpm prune --prod

# --- Runtime ----------------------------------------------------------------
FROM node:${NODE_MAJOR}-bookworm-slim AS runtime

WORKDIR /app

ARG APP_VERSION=dev

ENV NODE_ENV=production \
  LISTEN_HOST=0.0.0.0 \
  LISTEN_PORT=8080 \
  LOG_LEVEL=warn \
  TZ=UTC \
  SERVICE_VERSION=${APP_VERSION}

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./

# The official image ships an unprivileged `node` user (uid 1000). Using it here means
# compose does not need a `user:` key, and the image is safe to run anywhere.
USER node

EXPOSE 8080

# node -e depends on no extra packages, so it survives a change of base image, and it
# honours BASE_PATH the same way the application does.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const b=(process.env.BASE_PATH||'').replace(/^\/+|\/+$/g,''); \
const p='/'+(b?b+'/':'')+'api/v1/health'; \
require('http').get('http://127.0.0.1:'+(process.env.LISTEN_PORT||8080)+p, \
r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# PID 1 signal handling comes from `init: true` in compose (or `docker run --init`),
# so no tini package is needed in the image.
ENTRYPOINT ["node", "--enable-source-maps"]
CMD ["dist/main.js"]
