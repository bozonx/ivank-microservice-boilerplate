# Changelog

Notable changes to this service. The format follows [Keep a Changelog](https://keepachangelog.com/),
and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
