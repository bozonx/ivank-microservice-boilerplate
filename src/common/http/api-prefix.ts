/**
 * Builds the global API prefix from an optional base path.
 *
 * Every service normalises `BASE_PATH` the same way, so the rule lives here rather than
 * being re-implemented per service: leading and trailing slashes are stripped, an empty
 * or whitespace-only value means "no prefix".
 *
 * @param basePath - Raw `BASE_PATH` value, may be undefined, empty or slash-padded.
 * @param apiPath - Version segment appended after the base path.
 * @returns Prefix without leading or trailing slashes, e.g. `app/api/v1` or `api/v1`.
 */
export function buildApiPrefix(basePath: string | undefined, apiPath = 'api/v1'): string {
  const normalized = normalizeBasePath(basePath);
  return normalized ? `${normalized}/${apiPath}` : apiPath;
}

/**
 * Strips leading and trailing slashes from a base path.
 *
 * @param basePath - Raw `BASE_PATH` value.
 * @returns Base path without surrounding slashes, or an empty string.
 */
export function normalizeBasePath(basePath: string | undefined): string {
  return (basePath ?? '').trim().replace(/^\/+|\/+$/g, '');
}
