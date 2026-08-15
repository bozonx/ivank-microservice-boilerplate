import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { HealthService } from './health.service.js';
import { SERVICE_NAME, SERVICE_VERSION } from '../../config/service-info.js';

/** Shape returned by the health endpoint. */
export interface HealthResponse {
  status: 'ok' | 'shutting_down';
  service: string;
  version: string;
  uptimeSec: number;
}

/**
 * Health check controller.
 *
 * Serves `{prefix}/health` and is always reachable without authentication.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /**
   * Reports service liveness.
   *
   * @returns `200` with `ok` while serving, `503` with `shutting_down` while draining.
   */
  @Get()
  public check(@Res() reply: FastifyReply): void {
    const shuttingDown = this.health.isShuttingDown();
    const body: HealthResponse = {
      status: shuttingDown ? 'shutting_down' : 'ok',
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      uptimeSec: this.health.uptimeSec(),
    };

    void reply.status(shuttingDown ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.OK).send(body);
  }
}
