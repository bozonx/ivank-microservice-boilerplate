import 'reflect-metadata';
import { setTimeout as sleep } from 'node:timers/promises';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import type { AppConfig } from './config/app.config.js';
import { SERVICE_NAME, SERVICE_VERSION } from './config/service-info.js';
import { buildApiPrefix } from './common/http/api-prefix.js';
import { registerAuthHook } from './common/auth/auth.hook.js';
import { HealthService } from './modules/health/health.service.js';

async function bootstrap() {
  // Buffer logs so nothing emitted during startup is lost before Pino is attached.
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: false, // Pino handles logging.
    }),
    {
      bufferLogs: true,
    },
  );

  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);
  const logger = app.get(Logger);
  const config = configService.get<AppConfig>('app');
  if (!config) {
    throw new Error('App configuration is missing; check config registration in AppModule');
  }

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  const globalPrefix = buildApiPrefix(config.basePath);
  app.setGlobalPrefix(globalPrefix);

  registerAuthHook(app.getHttpAdapter().getInstance(), {
    basicUser: config.authBasicUser,
    basicPass: config.authBasicPass,
    bearerTokens: config.authBearerTokens,
    // Health must stay reachable for probes even when the service is otherwise closed.
    publicPaths: [`${globalPrefix}/health`],
  });

  // Deliberately not app.enableShutdownHooks(): Nest's handler closes the HTTP server
  // immediately, so the `shutting_down` health response would never be observable from
  // outside. Shutdown is driven here instead.
  registerShutdown(app, config.shutdownDrainSeconds, logger);

  await app.listen(config.port, config.host);

  logger.log(
    `${SERVICE_NAME} ${SERVICE_VERSION} listening on http://${config.host}:${config.port}/${globalPrefix}`,
    'Bootstrap',
  );
  logger.log(
    `environment=${config.nodeEnv} logLevel=${config.logLevel} auth=${config.authEnabled ? 'enabled' : 'disabled'}`,
    'Bootstrap',
  );
}

/**
 * Drains the instance on SIGTERM/SIGINT, then closes the app.
 *
 * The sequence matters: health starts reporting `shutting_down` while the server is still
 * accepting connections, so the load balancer can take this instance out of rotation before
 * any request is refused. Only after the drain window does the app close, which runs Nest's
 * shutdown hooks and finishes in-flight work.
 *
 * @param app - Running application.
 * @param drainSeconds - Seconds to keep serving while reporting `shutting_down`.
 * @param logger - Logger for shutdown progress.
 */
function registerShutdown(app: NestFastifyApplication, drainSeconds: number, logger: Logger): void {
  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    // A second signal during the drain window must not start a parallel shutdown.
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    logger.log(`${signal} received, draining for ${drainSeconds}s`, 'Shutdown');
    app.get(HealthService).startDraining();

    if (drainSeconds > 0) {
      await sleep(drainSeconds * 1000);
    }

    await app.close();
    logger.log('Shutdown complete', 'Shutdown');
    process.exit(0);
  };

  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      void shutdown(signal);
    });
  }
}

void bootstrap();
