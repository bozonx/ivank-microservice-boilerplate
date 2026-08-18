import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import type { AppConfig } from './config/app.config.js';
import type { AuthConfig } from './config/auth.config.js';
import { registerAuthHook } from './common/auth/auth.hook.js';
import { buildApiPrefix } from './common/http/api-prefix.js';

/**
 * Creates the HTTP adapter with the settings the fleet expects.
 *
 * @returns A configured Fastify adapter.
 */
export function createFastifyAdapter(): FastifyAdapter {
  return new FastifyAdapter({
    // Pino handles logging; Fastify's own logger would duplicate every line.
    logger: false,
    // Without this, keep-alive connections keep `app.close()` pending until the client goes
    // away, which turns a graceful shutdown into a hang the orchestrator has to SIGKILL.
    forceCloseConnections: true,
    // The service runs behind a reverse proxy, so the peer address is always the proxy's.
    // Without this every log line would record the proxy instead of the calling host.
    trustProxy: true,
  });
}

/**
 * Applies the wiring shared by `main.ts` and the e2e suite.
 *
 * Anything applied only in `main.ts` is invisible to the tests: a prefix or auth change would
 * pass the whole suite and still break in production. This function is the single place where
 * the running application is assembled.
 *
 * @param app - Created, not yet initialised application.
 */
export function configureApp(app: NestFastifyApplication): void {
  const configService = app.get(ConfigService);
  const appConfig = configService.getOrThrow<AppConfig>('app');
  const authConfig = configService.getOrThrow<AuthConfig>('auth');

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  const globalPrefix = buildApiPrefix(appConfig.basePath);
  app.setGlobalPrefix(globalPrefix);

  registerAuthHook(app.getHttpAdapter().getInstance(), {
    basicUser: authConfig.basicUser,
    basicPass: authConfig.basicPass,
    bearerTokens: authConfig.bearerTokens,
    // Health must stay reachable for probes even when the service is otherwise closed.
    publicPaths: [`${globalPrefix}/health`],
  });
}
