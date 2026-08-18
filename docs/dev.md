# Development Guide

## Requirements

- Node.js 24 — the version lives in `.nvmrc` and nowhere else
- pnpm 11, pinned in `package.json#packageManager`

`engine-strict=true` in `.npmrc` means installing with the wrong Node version fails immediately
rather than producing a subtly broken tree.

## Setup

```bash
pnpm install
cp .env.example .env
pnpm dev
```

`pnpm dev` runs the app in watch mode with `NODE_ENV=development`, which switches logging to
`pino-pretty`. The API is at `http://localhost:8080/api/v1`.

## Scripts

| Script                              | What it does                                                     |
| ----------------------------------- | ---------------------------------------------------------------- |
| `pnpm dev`                          | Watch mode                                                       |
| `pnpm dev:debug`                    | Watch mode with the inspector attached                           |
| `pnpm build`                        | Compile to `dist/`                                               |
| `pnpm start`                        | Run the compiled app; takes no environment decisions of its own  |
| `pnpm typecheck`                    | `tsc --noEmit` over `src/` **and** `test/`                       |
| `pnpm lint` / `pnpm lint:fix`       | Lint; `lint` never writes files, so CI can rely on it            |
| `pnpm format` / `pnpm format:check` | Prettier write / verify                                          |
| `pnpm test`                         | Both projects                                                    |
| `pnpm test:unit` / `pnpm test:e2e`  | One project                                                      |
| `pnpm test:watch` / `pnpm test:cov` | Watch / coverage                                                 |
| `pnpm test:debug`                   | Inspector, serial, with open-handle detection                    |
| `pnpm check`                        | typecheck + lint + format check — static analysis only           |
| `pnpm validate`                     | `check` + unit tests — run this before considering a change done |
| `pnpm validate:all`                 | `check` + coverage run of both projects + build — what CI runs   |
| `pnpm check:fleet`                  | Reports drift in fleet-shared files against the boilerplate      |
| `pnpm docker:*`                     | Compose wrappers                                                 |
| `pnpm clean`                        | Remove build artifacts                                           |

Run `pnpm validate` before considering a change finished, and `pnpm validate:all` before
opening a pull request — CI runs exactly the latter.

`pnpm check:fleet` compares the files that must be identical in every service against the
boilerplate checkout it finds next to this one (or at `FLEET_BOILERPLATE_PATH`). It skips
itself when there is no checkout to compare against, so it is a local guard rather than a CI
gate.

## Tests

Jest is split into two projects. Unit tests live in `test/unit/` and block outbound network
calls through nock. E2E tests live in `test/e2e/` and drive the real application through
`app.inject`, with no socket involved.

E2E tests build the app through `test/e2e/test-app.factory.ts`. Both it and `src/main.ts` call
`configureApp()`, so there is one place where the application is assembled: wiring applied only
in `main.ts` would pass every test and still break in production.

Tests import `describe`, `it`, `expect` and friends from `@jest/globals`; injected globals are
switched off. That is what gives the matchers real types — an injected `expect` is `any`, and
`expect(mock).toHaveBeenCalledWith(200)` on a mock that takes no arguments type-checks fine.

Jest needs `NODE_OPTIONS=--experimental-vm-modules` for ESM. It is set on the test scripts —
pnpm, unlike npm, does not apply `node-options` from `.npmrc` to script execution.

## Project layout

```
src/
  common/
    auth/        optional Basic and Bearer authentication hook
    filters/     global exception filter
    http/        API prefix helper
    logger/      pino configuration factory
    utils/       validation-error formatting
  config/        configuration, validation helper and service identity
  modules/
    health/      health endpoint and drain state
test/
  unit/          unit tests
  e2e/           end-to-end tests
  setup/         per-project setup
```

Imports between source files are relative and carry a `.js` extension — that is what Node's ESM
loader requires. TypeScript path aliases are not used: with a plain `tsc` emit they are not
rewritten, so they would need extra tooling to work at runtime.

## Configuration

`.env.example` documents every supported variable and is the source of truth. There is exactly
one other env file — `.env`, git-ignored, for local development. There are no per-environment
env files: the differences between development and production are defaults in code and `ENV`
directives in the Dockerfile.

Configuration is validated on startup by `src/config/app.config.ts`; invalid values stop the
process rather than producing surprising behaviour later.

## Service identity

`src/config/service-info.ts` holds the service name and version. Nothing imports `package.json`
at runtime. The version is injected at build time via the `APP_VERSION` build arg and shows up
as `dev` outside a built image.

## Things worth knowing

- A strict `ValidationPipe` is global: unknown properties are rejected, not ignored.
- Health is never authenticated, so probes keep working when auth is on.
- Health auto-logging is suppressed in production and kept in development.
- `authorization`, `x-api-key` and `cookie` headers are redacted in logs.
