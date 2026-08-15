# Fleet Compliance Checklist

Run through this list when adopting `docs/standards.md` in a service, and again when reviewing a
service that claims to be compliant. Every unchecked item is either a defect or an entry in the
"Allowed deviations" section of the standard.

## Runtime

- [ ] `.nvmrc` exists and matches `package.json#engines.node`
- [ ] `package.json#packageManager` matches the fleet-wide pnpm version
- [ ] `.npmrc` sets `engine-strict=true`
- [ ] `.editorconfig` present

## Scripts

- [ ] Script names match the table in the standard, with no extras and no missing entries
- [ ] `start` does not set `NODE_ENV`
- [ ] `lint` does not pass `--fix`; `lint:fix` exists separately
- [ ] `check` exists and runs typecheck, lint, format check and unit tests
- [ ] Exactly one `test:debug` script

## Configuration

- [ ] Exactly two env files: `.env.example` (committed) and `.env` (ignored)
- [ ] No `.env.development`, `.env.production` or other per-environment files anywhere
- [ ] Every variable in `.env.example` is documented with a comment
- [ ] Config is validated at startup and refuses to boot when invalid
- [ ] `src/config/service-info.ts` exists; nothing imports `package.json` at runtime
- [ ] No unused TypeScript path aliases in `tsconfig.json`

## HTTP

- [ ] API prefix is built with the shared helper and honours `BASE_PATH`
- [ ] `GET {prefix}/health` returns `status`, `service`, `version`, `uptimeSec`
- [ ] Health returns `503 shutting_down` during graceful shutdown
- [ ] SIGTERM drains before closing, verified against a running container
- [ ] Health is reachable without authentication
- [ ] An e2e test covers a non-empty `BASE_PATH`

## Docker

- [ ] Image builds from a clean clone with no pre-built `dist/`
- [ ] Multi-stage build
- [ ] Runtime stage runs as a non-root user
- [ ] `HEALTHCHECK` present, uses `node -e`, honours `BASE_PATH`
- [ ] No `tini` package; PID 1 handled by `init: true`
- [ ] `.dockerignore` is a whitelist
- [ ] No `COPY . .` anywhere in the Dockerfile

## Compose

- [ ] `build:` section present with `context: ..`
- [ ] `env_file` points at `../.env`
- [ ] `init: true`, `restart`, `stop_grace_period` set
- [ ] Healthcheck matches the one in the image
- [ ] Log rotation configured
- [ ] Memory limit set
- [ ] No `user:` key (the image handles it)
- [ ] Volumes follow the standard, or a comment states none are needed

## Dependencies

- [ ] No exact version pins in the manifest
- [ ] Shared packages use the same ranges as the boilerplate
- [ ] `pnpm audit` reports no critical findings
- [ ] `pnpm.overrides` entries carry a comment naming the advisory
- [ ] `renovate.json` present

## Documentation

- [ ] `README.md` in English, covering quick start, env vars and endpoints
- [ ] `docs/dev.md`, `docs/deploy.md`, `docs/CHANGELOG.md` present
- [ ] `AGENTS.md` common section byte-identical to the boilerplate's
- [ ] No documentation describing things that do not exist

## CI

- [ ] `ci.yml` runs `pnpm check` and e2e on pull requests
- [ ] Secret scanning runs in CI
- [ ] `pnpm audit --audit-level=critical` runs in CI
- [ ] Release workflow is triggered by tags, not by every push to the default branch
