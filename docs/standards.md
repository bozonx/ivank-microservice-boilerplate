# Microservice Fleet Standard

This document is the single source of truth for how every microservice in this fleet is wired.
It describes the tooling, not the business logic. When a service deviates, the deviation must be
listed in the "Allowed deviations" section at the bottom of this file — otherwise it is a defect.

Services covered:

| Service                             | Stack                                       |
| ----------------------------------- | ------------------------------------------- |
| `ivank-microservice-boilerplate`    | NestJS + Fastify (reference implementation) |
| `image-processing-microservice`     | NestJS + Fastify + Sharp                    |
| `page-scraper-microservice`         | NestJS + Fastify + Playwright               |
| `social-media-posting-microservice` | NestJS + Fastify                            |
| `stt-gateway-microservice`          | Hono (Node.js + Cloudflare Workers)         |
| `translate-gateway-microservice`    | Hono (Node.js + Cloudflare Workers)         |

## 1. Runtime and package manager

- Node.js major version is declared in exactly one place: `.nvmrc`. `package.json#engines.node`
  must agree with it, and `docker/Dockerfile` reads it through the `NODE_MAJOR` build arg.
- Package manager is pnpm, pinned via `package.json#packageManager`. All services use the same
  version; bumping it is a fleet-wide change, not a per-service one.
- `.npmrc` sets `engine-strict=true` so a wrong Node version fails at install time, not at runtime.

## 2. Scripts

Every `package.json` exposes the same script names. Implementations differ (nest build vs tsc,
jest vs vitest); names do not.

| Script                                                                       | Purpose                                                                       |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `dev`                                                                        | Watch mode for local development                                              |
| `dev:debug`                                                                  | Watch mode with the inspector attached                                        |
| `build`                                                                      | Compile to `dist/`                                                            |
| `start`                                                                      | Run the compiled app. Takes no environment decisions — env comes from outside |
| `typecheck`                                                                  | `tsc -p tsconfig.spec.json --noEmit` — covers `src/` **and** `test/`          |
| `lint` / `lint:fix`                                                          | Lint without / with `--fix`. `lint` must never write files: CI depends on it  |
| `format` / `format:check`                                                    | Prettier write / verify, over the whole repository                            |
| `test` / `test:unit` / `test:e2e` / `test:watch` / `test:cov` / `test:debug` | Tests                                                                         |
| `check`                                                                      | `typecheck && lint && format:check` — static analysis, no test run            |
| `check:fleet`                                                                | Reports drift in fleet-shared files against the boilerplate                   |
| `validate`                                                                   | `check && test:unit` — what a developer runs before calling work finished     |
| `validate:all`                                                               | `check && test:cov && build` — exactly what CI runs                           |
| `docker:build` / `docker:up` / `docker:down` / `docker:logs`                 | Compose wrappers                                                              |
| `clean`                                                                      | Remove build artifacts                                                        |

Services running on Cloudflare Workers additionally expose `dev:worker` and `deploy:worker`.

Rules:

- The three levels are not interchangeable. `check` is static analysis and must stay fast enough
  to run on every save. `validate` adds unit tests and is the bar for "finished". `validate:all`
  adds the e2e suite, coverage thresholds and a build, and is what CI runs — so CI never runs
  something a developer has no single command for.
- `typecheck` covers the tests too. Pointing it at a config that includes only `src/` is how a
  repository ends up with a green pipeline and type errors in its own test suite.
- `lint` runs with `--max-warnings=0`. A warning nothing fails on is a warning that accumulates.
- `format` and `format:check` run over the whole repository, not over `{src,test}/**/*.ts`.
  Configuration files, workflows and Markdown are the ones that quietly drift out of style.
- No `NODE_ENV` baked into `start`. Production environment is set by the image and the orchestrator.
- Runner flags that Jest needs for ESM (`NODE_OPTIONS=--experimental-vm-modules`) sit on the
  scripts that start Jest. They cannot move to `.npmrc`: pnpm, unlike npm, does not apply
  `node-options` to script execution.
- One `test:debug`, not one per test project.

## 3. Configuration and environment

- Exactly two env files exist: `.env` (git-ignored, local development only) and `.env.example`
  (committed, the source of truth for every supported variable).
- There are no per-environment env files. Differences between development and production are
  defaults in code and `ENV` directives in the Dockerfile, not separate files.
- In containers the environment comes from compose or the orchestrator. No env file is read there.
- Every variable in `.env.example` carries a comment explaining what it does and its default.
- Config is validated at startup and the process refuses to boot on invalid config.

Base variables present in every service:

```
NODE_ENV       development | production | test
LISTEN_HOST    bind address
LISTEN_PORT    bind port, default 8080
BASE_PATH      optional path prefix, empty by default
LOG_LEVEL      trace | debug | info | warn | error | fatal | silent
TZ             application timezone, default UTC
SERVICE_NAME   overrides the built-in service name, optional
SERVICE_VERSION  overrides the version reported in logs and health, set by the image
SHUTDOWN_DRAIN_SECONDS       drain window before closing
SHUTDOWN_FORCE_EXIT_SECONDS  cap on the close itself, after which the process exits non-zero
```

Configuration is assembled per namespace with `registerAs` and validated through the shared
`validateConfig()` helper, so every namespace fails the same way and names the offending
property. Namespaces are split by subject — `app`, `auth`, and whatever the service itself
needs — rather than collected into one class that grows with the service.

## 4. Service identity

Service name and version come from `src/config/service-info.ts`, never from importing
`package.json` at runtime. Importing the manifest forces `resolveJsonModule`, breaks bundling for
Cloudflare Workers, and hard-codes the depth of the `dist/` layout.

The version is injected at build time through the `APP_VERSION` build arg and surfaces in
`SERVICE_VERSION`. Identity is used in exactly three places: the logger base fields, the health
response, and (later) OpenTelemetry resource attributes.

## 5. HTTP surface

- All routes live under `{BASE_PATH}/api/v1`, built with the shared `buildApiPrefix()` helper.
  `BASE_PATH` is normalised in one place, not re-implemented per service.
- `GET {prefix}/health` is unauthenticated and returns:

  ```json
  { "status": "ok", "service": "<name>", "version": "<version>", "uptimeSec": 123 }
  ```

  During graceful shutdown it returns `503` with `"status": "shutting_down"` so the load balancer
  drains the instance before the process exits.

- Shutdown is driven explicitly, not by `enableShutdownHooks()` alone: on SIGTERM the service
  marks itself draining, keeps serving for `SHUTDOWN_DRAIN_SECONDS`, and only then closes. Nest's
  built-in handler closes the server immediately, which makes the `shutting_down` response
  unobservable from outside and defeats the purpose.
- Shutdown always ends in an explicit exit status: `0` after a clean close, `1` when the close
  throws, and `1` after `SHUTDOWN_FORCE_EXIT_SECONDS` when it never returns at all. A hang that
  is left to the orchestrator's SIGKILL is reported as a clean stop, so the defect stays
  invisible. `SHUTDOWN_DRAIN_SECONDS + SHUTDOWN_FORCE_EXIT_SECONDS` must stay below the compose
  `stop_grace_period`.
- The HTTP adapter is created with `forceCloseConnections: true`. Without it a keep-alive
  connection keeps `close()` pending, which is the most common way a graceful shutdown turns
  into the hang above.
- Authentication is opt-in through env. If neither Basic nor Bearer credentials are configured the
  service is public; if any are configured, every route except health requires authentication.
  The rule is deny-by-default: the hook holds a list of public paths, not a list of protected
  prefixes, so a route added later is closed until someone opens it deliberately.
- Bearer credentials are named: `AUTH_BEARER_TOKENS=name:token,name:token`. The name identifies
  the calling service in logs (`req.client`) and lets one caller be revoked without rotating
  everyone else's token. An entry without a name fails at startup — an unattributable caller is
  a gap in the audit trail, not a convenience.
- Credentials are compared as SHA-256 digests through `timingSafeEqual`. Digests are fixed length,
  so neither the value nor the length of a secret leaks through timing.

## 6. Logging

- Structured JSON via Pino in production, `pino-pretty` in development.
- Base fields on every line: `service`, `environment`. Timestamps are ISO-8601 under `@timestamp`.
- `authorization` and `x-api-key` headers are redacted.
- Health-check requests are not auto-logged in production.

## 7. Docker

The Dockerfile builds the project itself. No target may require a pre-built `dist/` in the
working tree — the image must be reproducible from a clean clone.

- Multi-stage: `deps` -> `build` -> `runtime`.
- The runtime stage runs as the non-root `node` user. `user:` in compose is not how this is done.
- `HEALTHCHECK` uses `node -e`, which depends on no packages and works on any base image.
  It honours `BASE_PATH`.
- PID 1 signal handling comes from `init: true` in compose (or `--init`), not from a `tini`
  package inside the image.
- `.dockerignore` is a whitelist: deny everything, then allow what the build needs. A blacklist
  eventually misses a secret — that is how `.env.production` and service-account keys reach the
  builder layer.
- `COPY . .` is forbidden. Copy the specific paths the build needs.

## 8. Compose

One `docker/docker-compose.yml` per service, with a `build:` section so the image can be built
from the repository without arguments. Mandatory: `restart`, `init: true`, `stop_grace_period`,
`healthcheck`, log rotation, and a memory limit. `env_file` paths are relative to the compose
file, so they are written as `../.env`.

Volumes: named volumes for persistent data, bind mounts only for configuration and only `:ro`,
`tmpfs` for scratch space. A service with no volumes says so in a comment, so the question is not
reopened at every review.

## 9. Dependencies

- Ranges are always caret (`^`). Exact pins in the manifest are forbidden: they silently block
  security patches. Reproducibility is the lock file's job.
- Shared packages carry the same range across all services. The boilerplate defines the range.
- Transitive vulnerabilities that cannot be fixed by upgrading a direct dependency are pinned
  through `pnpm.overrides`, with a comment naming the advisory.
- CI fails on `critical` findings from `pnpm audit`; `high` is reported but not blocking.
- Renovate groups updates by ecosystem, auto-merges dev-dependency patches and minors on green CI,
  and raises majors as individual pull requests.

## 10. Repository layout

```
src/
  common/        cross-cutting code (filters, guards, helpers)
  config/        configuration and service identity
  modules/       feature modules
test/
  unit/          unit tests
  e2e/           end-to-end tests
  setup/         per-project setup files
docs/            user-facing guides, API reference, CHANGELOG
dev_docs/        working notes for in-progress development
docker/          Dockerfile and compose
```

Imports between source files are relative and carry the `.js` extension, which is what
Node's ESM loader requires. TypeScript path aliases are deliberately not used: with a plain
`tsc` emit they are not rewritten, so they need a post-processing step to work at runtime,
and the fleet has no case that justifies that machinery.

## 11. Documentation

- `README.md` — what the service does, quick start, environment variables, endpoints.
- `docs/dev.md` — development guide.
- `docs/deploy.md` — Docker and production notes.
- `docs/CHANGELOG.md` — updated for every significant change.
- `AGENTS.md` — agent rules, shared preamble plus a service-specific section.
- Everything is written in English.

## 12. Tooling configuration

- ESLint flat config in `eslint.config.js`, built with the `typescript-eslint` meta package and
  `projectService: true`. The legacy `.eslintrc.*` format is not used, and neither is a lint-only
  `tsconfig.eslint.json`: `projectService` resolves the nearest config per file.
- Prettier is a separate step, never an ESLint rule. `eslint-plugin-prettier` reports formatting
  as lint errors, which makes one problem show up in two tools and slows both down.
- Prettier configuration in `.prettierrc.yml`, so options can carry comments, with
  `.prettierignore` covering generated files.
- `.editorconfig` present in every repository.
- Jest runs with `injectGlobals: false`; tests import from `@jest/globals` so matchers are typed.
- `coverageThreshold` is set in every service. The number is a floor that only moves up.

### Fleet-shared files

These files are byte-identical in every service, and `pnpm check:fleet` reports it when they are
not: `.editorconfig`, `.npmrc`, `.prettierrc.yml`, `.prettierignore`, `eslint.config.js`,
`renovate.json`, `scripts/check-fleet.mjs`, the three root `tsconfig*.json` files, `test/tsconfig.json`,
`test/e2e/env-helper.ts`, `src/common/**` (auth hook, exception filter, API prefix, logger
factory, validation errors), `src/config/{auth.config,env,validate-config}.ts`,
`src/modules/health/health.service.ts`, the three workflow files, and the "Common rules" section
of `AGENTS.md`.

Service-specific by design, and therefore not on that list: `src/configure-app.ts` (each service
registers its own plugins and routes), `src/config/app.config.ts` (service-specific variables),
`jest.config.js` (coverage thresholds differ), `docker/*`, `.dockerignore` and `.env.example`.

## Allowed deviations

Deviations that are inherent to a service's platform, and are therefore not defects:

- `stt-gateway-microservice`, `translate-gateway-microservice`: `wrangler.toml`, `.dev.vars`, two
  entry points (Node and Workers) and a Workers-specific build. `dev:worker` and `deploy:worker`
  scripts exist only here.
- `translate-gateway-microservice`: tests run on Vitest rather than Jest. Script names are
  unchanged; only the runner differs.
- `image-processing-microservice`: the health response carries an extra `queue` object
  (`size`, `pending`). Queue saturation is the failure mode that matters for this service, and a
  probe that cannot see it is not much of a probe. The four standard fields are unchanged.
- `page-scraper-microservice`: the Docker image carries Chromium and its font packages, and the
  compose file sets `shm_size`.
- `social-media-posting-microservice`: `config.yaml` is the source of truth for platform
  configuration and is mounted read-only.
