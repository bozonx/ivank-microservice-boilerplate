/**
 * Service identity.
 *
 * These values are deliberately not read from `package.json` at runtime: importing the
 * manifest forces `resolveJsonModule`, breaks bundling for non-Node targets, and ties the
 * code to the depth of the `dist/` layout.
 *
 * The version is injected at build time — see the `APP_VERSION` build arg in
 * `docker/Dockerfile`. Outside a built image it stays `dev`, which is the honest answer.
 */

/** Default name used when `SERVICE_NAME` is not set. */
const DEFAULT_SERVICE_NAME = 'microservice-boilerplate';

/**
 * Reads an environment variable, treating blank values as unset.
 *
 * @param value - Raw environment value.
 * @param fallback - Value to use when the variable is unset or blank.
 * @returns Trimmed value or the fallback.
 */
function readOr(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed !== undefined && trimmed !== '' ? trimmed : fallback;
}

/** Name reported in logs and in the health response. */
export const SERVICE_NAME: string = readOr(process.env.SERVICE_NAME, DEFAULT_SERVICE_NAME);

/** Version reported in the health response. */
export const SERVICE_VERSION: string = readOr(process.env.SERVICE_VERSION, 'dev');
