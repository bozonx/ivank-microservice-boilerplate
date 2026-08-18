# Microservice Boilerplate (NestJS + Fastify)

Reference implementation for this fleet of microservices. It is deliberately small: a health
endpoint, structured logging, optional authentication and a production Docker setup. Everything
else is what a new service adds on top.

The wiring here is the fleet standard — see [`docs/standards.md`](docs/standards.md).

## What is included

- `GET {BASE_PATH}/api/v1/health` reporting service name, version, uptime and drain state
- Structured JSON logging via Pino, pretty-printed in development
- Optional Basic and Bearer authentication, off until credentials are configured
- Global exception filter and a strict validation pipe
- Graceful shutdown that drains the health endpoint before the process exits
- Multi-stage Dockerfile that builds the project itself and runs as a non-root user
- Jest suites split into `unit` and `e2e`

## Requirements

- Node.js 24 (see `.nvmrc`)
- pnpm 11

## Quick start

```bash
pnpm install
cp .env.example .env
pnpm dev
```

The API is then served at `http://localhost:8080/api/v1`.

```bash
curl http://localhost:8080/api/v1/health
# {"status":"ok","service":"microservice-boilerplate","version":"dev","uptimeSec":3}
```

## Running in Docker

The image builds the project itself, so a clean clone is enough:

```bash
pnpm docker:build
pnpm docker:up
pnpm docker:logs
```

See [`docs/deploy.md`](docs/deploy.md) for the production notes.

## Environment variables

`.env.example` is the source of truth and documents every supported variable. Copy it to `.env`
for local development. In containers the environment comes from compose or the orchestrator —
no env file is read there.

| Variable                              | Default      | Purpose                                                                    |
| ------------------------------------- | ------------ | -------------------------------------------------------------------------- |
| `NODE_ENV`                            | `production` | `development`, `production` or `test`                                      |
| `LISTEN_HOST`                         | `0.0.0.0`    | Bind address                                                               |
| `LISTEN_PORT`                         | `8080`       | Bind port                                                                  |
| `BASE_PATH`                           | empty        | Optional path prefix; API moves to `{BASE_PATH}/api/v1`                    |
| `LOG_LEVEL`                           | `warn`       | Pino level                                                                 |
| `TZ`                                  | `UTC`        | Application timezone                                                       |
| `SERVICE_NAME`                        | package name | Overrides the name in logs and health                                      |
| `SHUTDOWN_DRAIN_SECONDS`              | `5`          | Seconds to keep serving after SIGTERM while health reports `shutting_down` |
| `AUTH_BASIC_USER` / `AUTH_BASIC_PASS` | empty        | Enables Basic auth when both are set                                       |
| `AUTH_BEARER_TOKENS`                  | empty        | Comma-separated accepted Bearer tokens                                     |

## Authentication

Authentication is opt-in. With no credentials configured the service is public. Configure Basic
credentials, Bearer tokens, or both, and every route except health starts requiring a match.

```bash
curl -H 'Authorization: Bearer my-token' http://localhost:8080/api/v1/something
```

The check runs in Fastify's `onRequest` hook, before routing and body parsing, so an unknown
route cannot be used to probe past it.

## Endpoints

| Method | Path                        | Auth           | Description                        |
| ------ | --------------------------- | -------------- | ---------------------------------- |
| `GET`  | `{BASE_PATH}/api/v1/health` | never required | Liveness, identity and drain state |

Health returns `200` with `"status": "ok"` while serving and `503` with
`"status": "shutting_down"` from the moment shutdown begins, so a load balancer stops routing to
the instance before it disappears.

## Development

See [`docs/dev.md`](docs/dev.md).

## License

MIT
