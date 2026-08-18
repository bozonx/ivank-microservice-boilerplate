import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createTestApp } from './test-app.factory.js';
import { withEnvVars } from './env-helper.js';

describe('Authentication (e2e)', () => {
  let app: NestFastifyApplication;
  let restoreEnv: () => void;

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    restoreEnv?.();
  });

  describe('when no credentials are configured', () => {
    beforeEach(async () => {
      restoreEnv = withEnvVars({
        AUTH_BASIC_USER: '',
        AUTH_BASIC_PASS: '',
        AUTH_BEARER_TOKENS: '',
      });
      app = await createTestApp();
    });

    it('serves requests without an Authorization header', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/v1/health' });
      expect(response.statusCode).toBe(200);
    });
  });

  describe('with Bearer tokens configured', () => {
    beforeEach(async () => {
      restoreEnv = withEnvVars({
        AUTH_BEARER_TOKENS: 'svc-one:token-one, svc-two:token-two',
      });
      app = await createTestApp();
    });

    it('keeps health public so probes keep working', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/v1/health' });
      expect(response.statusCode).toBe(200);
    });

    it('rejects an unauthenticated request to a non-public route', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/v1/anything' });
      expect(response.statusCode).toBe(401);
    });

    it('rejects a wrong token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/anything',
        headers: { authorization: 'Bearer wrong-token' },
      });
      expect(response.statusCode).toBe(401);
    });

    it('accepts any configured token and falls through to routing', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/anything',
        headers: { authorization: 'Bearer token-two' },
      });
      // Authenticated, so the request reaches the router and 404s on an unknown route.
      expect(response.statusCode).toBe(404);
    });

    it('does not let a trailing slash bypass the guard', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/v1/anything/' });
      expect(response.statusCode).toBe(401);
    });

    it('does not let a query string bypass the guard', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/v1/anything?public=1' });
      expect(response.statusCode).toBe(401);
    });

    it('guards routes outside the api prefix too', async () => {
      const response = await app.inject({ method: 'GET', url: '/metrics' });
      expect(response.statusCode).toBe(401);
    });

    it('rejects a token whose name is right but secret is wrong', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/anything',
        headers: { authorization: 'Bearer svc-one:token-one' },
      });
      // The name is configuration, not a credential: only the secret half authenticates.
      expect(response.statusCode).toBe(401);
    });
  });

  describe('with a malformed bearer configuration', () => {
    it('refuses to start when a token entry has no caller name', async () => {
      restoreEnv = withEnvVars({ AUTH_BEARER_TOKENS: 'nameless-token' });
      await expect(createTestApp()).rejects.toThrow('AUTH_BEARER_TOKENS entry #1');
    });
  });

  describe('with Basic credentials configured', () => {
    beforeEach(async () => {
      restoreEnv = withEnvVars({ AUTH_BASIC_USER: 'admin', AUTH_BASIC_PASS: 'secret' });
      app = await createTestApp();
    });

    it('rejects a wrong password and offers the Basic challenge', async () => {
      const credentials = Buffer.from('admin:wrong').toString('base64');
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/anything',
        headers: { authorization: `Basic ${credentials}` },
      });
      expect(response.statusCode).toBe(401);
      expect(response.headers['www-authenticate']).toContain('Basic');
    });

    it('accepts correct credentials', async () => {
      const credentials = Buffer.from('admin:secret').toString('base64');
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/anything',
        headers: { authorization: `Basic ${credentials}` },
      });
      expect(response.statusCode).toBe(404);
    });
  });
});
