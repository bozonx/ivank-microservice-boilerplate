/**
 * Redis key helper.
 *
 * The fleet standard requires every Redis key to carry a service-scoped prefix so that
 * several services can share one instance (and so a stray `FLUSHDB` during development
 * cannot take out a neighbour). The rule is only enforceable if no code ever writes a raw
 * key string, which is what this helper is for.
 *
 * No Redis client is bundled here: the boilerplate has no Redis dependency, and services
 * that need one wire their own client around this helper.
 */

/**
 * Creates a key builder bound to a prefix.
 *
 * @param prefix - Key prefix, typically `${SERVICE_NAME}:`. A trailing colon is added when missing.
 * @returns Function joining parts into a prefixed, colon-separated key.
 * @throws When the prefix is empty — an unprefixed key is never acceptable.
 */
export function createKeyBuilder(prefix: string): (...parts: Array<string | number>) => string {
  const trimmed = prefix.trim();
  if (trimmed === '') {
    throw new Error('Redis key prefix must not be empty');
  }

  const normalized = trimmed.endsWith(':') ? trimmed : `${trimmed}:`;

  return (...parts: Array<string | number>): string => {
    if (parts.length === 0) {
      throw new Error('Redis key must have at least one part');
    }
    const joined = parts.map(part => String(part)).join(':');
    if (joined.includes(' ')) {
      throw new Error(`Redis key must not contain spaces: ${joined}`);
    }
    return `${normalized}${joined}`;
  };
}

/**
 * Builds the match pattern for scanning every key owned by a prefix.
 *
 * Pair this with `SCAN`, never `KEYS` — `KEYS` blocks the server for the whole sweep.
 *
 * @param prefix - Same prefix passed to {@link createKeyBuilder}.
 * @returns Glob pattern matching all keys under the prefix.
 */
export function keyPattern(prefix: string): string {
  const trimmed = prefix.trim();
  const normalized = trimmed.endsWith(':') ? trimmed : `${trimmed}:`;
  return `${normalized}*`;
}
