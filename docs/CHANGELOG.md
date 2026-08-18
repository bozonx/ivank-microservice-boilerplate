# Changelog

Notable changes to this service. The format follows [Keep a Changelog](https://keepachangelog.com/),
and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- **Breaking (scripts).** `check` is now static analysis only (`typecheck && lint &&
format:check`). `validate` adds unit tests and is the bar for calling work finished;
  `validate:all` adds a coverage run of both projects and a build, and is exactly what CI runs.
  The old `check` did four different jobs and was still not what CI ran.
- `typecheck` now runs over `tsconfig.spec.json`, so `test/` is type-checked too. It never was,
  which is how `test/setup/*.ts` came to import an undeclared `@jest/globals` without anything
  noticing.
- `lint` fails on warnings (`--max-warnings=0`), and `format`/`format:check` cover the whole
  repository. `eslint.config.js` itself was indented with four spaces against a `tabWidth: 2`
  Prettier config, because the old glob never looked at it.
- Shutdown now always ends in an explicit exit status: `0` after a clean close, `1` when the
  close throws, and `1` after `SHUTDOWN_FORCE_EXIT_SECONDS` when it never returns. A close that
  hangs used to be left to the orchestrator's SIGKILL, which reports the container as stopped
  cleanly and hides the defect. The adapter also sets `forceCloseConnections: true`, the usual
  cause of such a hang.
- Configuration is split into an `app` and an `auth` namespace, both built through a shared
  `validateConfig()` helper that reports the failing property path instead of a bare constraint
  message. `plainToClass` was replaced with `plainToInstance` — the former is deprecated.
- ESLint moved to the `typescript-eslint` meta package with `projectService: true`, dropping the
  hand-maintained list of Node globals, the lint-only `tsconfig.eslint.json` and
  `eslint-plugin-prettier`. Formatting is Prettier's job in one place, not a lint rule as well.
  `no-deprecated`, `no-unnecessary-condition` and `eqeqeq` are now enforced; they immediately
  found three dead conditions in the exception filter.
- Jest runs with `injectGlobals: false` and a `coverageThreshold`; tests import from
  `@jest/globals`, which is what gives matchers their types. `jest.config.ts` became
  `jest.config.js`, removing the `ts-node` dependency.
- The exception filter now handles a response whose headers were already sent, instead of
  throwing a second error on top of a half-written body.
- Logging moved out of `app.module.ts` into `src/common/logger/logger.factory.ts`.
- Compose reads `../.env` with `required: false`, so a stack without a local env file starts.
- CI runs `pnpm validate:all` as a single step.

### Added

- `src/configure-app.ts`, holding the wiring shared by `main.ts` and the e2e suite. Anything
  applied in only one of the two passes the whole suite and still breaks in production.
- `src/config/env.ts`, loading `.env` before module-level constants read it. Without it
  `SERVICE_NAME` and `SERVICE_VERSION` from `.env` were silently ignored in local development.
- `SHUTDOWN_FORCE_EXIT_SECONDS`, and the previously undocumented `SERVICE_VERSION`, in
  `.env.example`.
- `pnpm check:fleet` (`scripts/check-fleet.mjs`), reporting drift in the files that are meant to
  be byte-identical across the fleet. The shared HTTP helpers, the exception filter and `main.ts`
  had already diverged between services with nothing to catch it.

### Removed

- `src/common/redis/redis-key.ts` and its test: no service in the fleet uses Redis, and the
  standard does not describe it.
- `test/helpers/mocks.ts`: referenced by nothing.
- `.windsurf/rules/common.md`: an empty stub duplicating `AGENTS.md`.
- `tsconfig.eslint.json`, and the `baseUrl`, `resolveJsonModule`, `declaration` and `ts-node`
  settings in `tsconfig.json` — none of them had a consumer.
- `!.env.*.example` from `.gitignore`, which contradicted the "exactly two env files" rule.
- `ts-node`, `tsconfig-paths`, `@typescript-eslint/*` and `eslint-plugin-prettier` dependencies.

### Changed

- **Breaking (configuration).** `AUTH_BEARER_TOKENS` entries are now `name:token` pairs instead of
  bare tokens. The name identifies the calling service in logs (`req.client`) and lets a single
  caller be revoked without rotating everyone else's credential. A bare token fails at startup with
  the offending entry's position — deliberately loud, because a caller nobody can attribute is a
  gap in the audit trail. Update every deployment's `AUTH_BEARER_TOKENS` before rolling this out.
- Credentials are compared as SHA-256 digests through `timingSafeEqual` instead of string equality,
  so neither a secret's value nor its length leaks through response timing.

### Added

- Split CI and release workflows: pull requests run checks, e2e, and a no-push image build;
  version tags publish cached multi-architecture images. Renovate policy is fleet-wide.
- Fleet standard (`docs/standards.md`) and a compliance checklist (`docs/compliance-checklist.md`).
- Optional Basic and Bearer authentication, applied in Fastify's `onRequest` hook so an unknown
  route cannot be used to probe past it.
- Service identity in `src/config/service-info.ts`, with the version injected at build time.
- Health endpoint now reports service name, version and uptime, and answers `503`
  `shutting_down` while the process drains.
- Shared `buildApiPrefix()` helper, covered by unit tests and an e2e test with a non-empty
  `BASE_PATH`.
- Redis key-prefix helper for services that add Redis, enforcing a non-empty prefix.
- `.nvmrc`, `.npmrc` (`engine-strict`), `.editorconfig`, `renovate.json`.
- `typecheck`, `lint:fix`, `format:check`, `check`, `docker:*` and `clean` scripts.
- Security workflow running secret scanning and a dependency audit.

### Changed

- Upgraded `class-validator` to 0.15.1 after validating the full unit and e2e suites.
- Node.js 22 to 24; pnpm pinned to 11.22.0 across the fleet.
- Dockerfile now builds the project itself (multi-stage), runs as a non-root user and carries a
  `HEALTHCHECK`. It no longer expects a pre-built `dist/`.
- `.dockerignore` converted to a whitelist.
- Compose gained `build:`, `init: true`, log rotation, a memory limit and `../.env`.
- `start:dev` renamed to `dev`, `start:prod` to `start`, `start:debug` to `dev:debug`.
- `lint` no longer passes `--fix`, so it can fail a build.
- Logging base fields now include the service version; the `cookie` header is redacted too.
- Documentation rewritten in English.

### Removed

- `.env.development` and `.env.production` along with their examples, replaced by a single
  `.env` plus `.env.example`.
- Four divergent `test:*:debug` scripts, replaced by one `test:debug`.
- Runtime import of `package.json` for the service name.
- Unused TypeScript path aliases from the documented standard.

### Security

- `@nestjs/platform-fastify` to >= 11.2.1, closing three middleware bypasses (trailing slash,
  HEAD request, URL encoding) that affected authentication implemented as a Fastify hook.
- `fastify` to >= 5.12.0, closing a body-validation bypass.
- `@fastify/static` to 10.x, closing a route-guard bypass via path traversal.
- Targeted `pnpm.overrides` for transitive advisories that no direct upgrade resolves.
