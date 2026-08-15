import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export interface AuthOptions {
  /** Basic auth user. Empty disables Basic auth. */
  basicUser: string;
  /** Basic auth password. Empty disables Basic auth. */
  basicPass: string;
  /** Accepted Bearer tokens. Empty disables Bearer auth. */
  bearerTokens: string[];
  /** Paths that stay public, without leading slash handling — compared after normalisation. */
  publicPaths: string[];
}

/**
 * Compares two strings without leaking their contents through timing.
 *
 * @param a - First value.
 * @param b - Second value.
 * @returns True when the values are identical.
 */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // timingSafeEqual throws on length mismatch, so compare lengths first — the length of a
  // credential is not the secret.
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * Checks an Authorization header against the configured credentials.
 *
 * @param header - Raw Authorization header value.
 * @param options - Configured credentials.
 * @returns True when the request is authenticated.
 */
function isAuthorized(header: string | undefined, options: AuthOptions): boolean {
  if (!header) {
    return false;
  }

  const [scheme, value] = header.split(' ');
  if (!scheme || !value) {
    return false;
  }

  if (scheme.toLowerCase() === 'bearer') {
    return options.bearerTokens.some(token => safeEqual(token, value));
  }

  if (scheme.toLowerCase() === 'basic' && options.basicUser !== '') {
    const decoded = Buffer.from(value, 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    if (separator === -1) {
      return false;
    }
    const user = decoded.slice(0, separator);
    const pass = decoded.slice(separator + 1);
    return safeEqual(options.basicUser, user) && safeEqual(options.basicPass, pass);
  }

  return false;
}

/**
 * Registers a global authentication hook on the Fastify instance.
 *
 * Authentication is opt-in: when no credentials are configured the hook is not registered
 * at all and the service stays public. When any are configured, every route except the
 * listed public paths requires a matching credential.
 *
 * The check runs in `onRequest`, before body parsing and before routing decisions, so it
 * cannot be sidestepped by an unmatched route or an oversized payload.
 *
 * @param instance - Fastify instance to guard.
 * @param options - Credentials and public paths.
 */
export function registerAuthHook(instance: FastifyInstance, options: AuthOptions): void {
  const authEnabled =
    (options.basicUser !== '' && options.basicPass !== '') || options.bearerTokens.length > 0;
  if (!authEnabled) {
    return;
  }

  const publicPaths = new Set(
    options.publicPaths.map(path => `/${path.replace(/^\/+|\/+$/g, '')}`),
  );

  instance.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Compare the path only, and strip any trailing slash: `/x/` and `/x` are the same route.
    const rawPath = request.url.split('?')[0] ?? '';
    const path = rawPath.length > 1 ? rawPath.replace(/\/+$/, '') : rawPath;

    if (publicPaths.has(path)) {
      return;
    }

    if (isAuthorized(request.headers.authorization, options)) {
      return;
    }

    if (options.basicUser !== '') {
      void reply.header('WWW-Authenticate', 'Basic realm="restricted", charset="UTF-8"');
    }
    return reply
      .status(401)
      .send({ statusCode: 401, error: 'Unauthorized', message: 'Unauthorized' });
  });
}
