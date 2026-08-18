import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createTestApp } from './test-app.factory.js';
import { withEnvVars } from './env-helper.js';
import { HealthService } from '../../src/modules/health/health.service.js';
import { SERVICE_NAME } from '../../src/config/service-info.js';

describe('Health (e2e)', () => {
  let app: NestFastifyApplication;

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('without BASE_PATH', () => {
    beforeEach(async () => {
      app = await createTestApp();
    });

    it('GET /api/v1/health reports service identity and uptime', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/v1/health' });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        status: 'ok',
        service: SERVICE_NAME,
        version: expect.any(String),
        uptimeSec: expect.any(Number),
      });
      expect(body.uptimeSec).toBeGreaterThanOrEqual(0);
    });

    it('reports shutting_down with 503 once draining has begun', async () => {
      // Simulate the SIGTERM path: Nest calls onApplicationShutdown before closing sockets,
      // and the load balancer must see 503 during that window.
      app.get(HealthService).onApplicationShutdown();

      const response = await app.inject({ method: 'GET', url: '/api/v1/health' });

      expect(response.statusCode).toBe(503);
      expect(JSON.parse(response.body).status).toBe('shutting_down');
    });
  });

  describe('with a non-empty BASE_PATH', () => {
    let restoreEnv: () => void;

    beforeEach(async () => {
      restoreEnv = withEnvVars({ BASE_PATH: '/my-app/' });
      app = await createTestApp();
    });

    afterEach(() => {
      restoreEnv();
    });

    it('serves health under the prefix', async () => {
      const response = await app.inject({ method: 'GET', url: '/my-app/api/v1/health' });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).status).toBe('ok');
    });

    it('does not serve health at the unprefixed path', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/v1/health' });
      expect(response.statusCode).toBe(404);
    });
  });
});
