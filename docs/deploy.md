# Deployment

## Image

`docker/Dockerfile` builds the project itself in three stages — `deps`, `build`, `runtime` — so
the image is reproducible from a clean clone. No target needs a pre-built `dist/`.

Notable properties:

- The runtime stage runs as the unprivileged `node` user that ships with the official image.
  Compose therefore needs no `user:` key.
- `HEALTHCHECK` uses `node -e`, which depends on no extra packages and survives a change of base
  image. It honours `BASE_PATH`.
- PID 1 signal handling comes from `init: true` in compose, so the image carries no `tini`.
- `.dockerignore` is a whitelist. Everything is denied and the build context is opened only for
  the files the build needs; a blacklist eventually misses a new secret file.

## Building

```bash
docker build -f docker/Dockerfile \
  --build-arg NODE_MAJOR=$(cat .nvmrc) \
  --build-arg APP_VERSION=$(node -p "require('./package.json').version") \
  -t ghcr.io/bozonx/microservice-boilerplate:latest .
```

`APP_VERSION` becomes `SERVICE_VERSION` inside the image and is what the health endpoint
reports. Omitting it leaves the version as `dev`, which is how you can tell an ad-hoc build from
a released one.

## Compose

```bash
pnpm docker:up
pnpm docker:logs
pnpm docker:down
```

`docker/docker-compose.yml` sets what production needs: restart policy, `init: true`, a grace
period for shutdown, a health check matching the image, log rotation and a memory limit.
`env_file` points at `../.env` because compose resolves paths relative to the compose file.

This service is stateless and mounts no volumes. A service that needs storage uses a named
volume; configuration is bind-mounted read-only; scratch space goes on `tmpfs`.

## Graceful shutdown

On `SIGTERM` Nest runs its shutdown hooks. The health endpoint immediately starts answering
`503` with `"status": "shutting_down"` while the process finishes in-flight requests, so a load
balancer can drain the instance before it goes away. `stop_grace_period` must stay longer than
the slowest expected request.

## Environment

Containers take their environment from compose or the orchestrator; no env file is read inside
the image. `.env.example` remains the reference for which variables exist.
