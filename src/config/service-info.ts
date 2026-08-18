import './env.js';

const DEFAULT_SERVICE_NAME = 'microservice-boilerplate';

/**
 * Returns the trimmed value, or the fallback when it is absent or blank.
 *
 * @param value - Raw environment value.
 * @param fallback - Value to use when nothing usable was provided.
 * @returns The effective value.
 */
function readOr(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed !== undefined && trimmed !== '' ? trimmed : fallback;
}

/** Service name used in logs and in the health response. */
export const SERVICE_NAME: string = readOr(process.env.SERVICE_NAME, DEFAULT_SERVICE_NAME);

/** Service version, injected at build time through the `APP_VERSION` build arg. */
export const SERVICE_VERSION: string = readOr(process.env.SERVICE_VERSION, 'dev');
