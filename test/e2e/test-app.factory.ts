import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../../src/app.module.js';
import type { AppConfig } from '../../src/config/app.config.js';
import { buildApiPrefix } from '../../src/common/http/api-prefix.js';
import { registerAuthHook } from '../../src/common/auth/auth.hook.js';

/**
 * Builds an app instance wired exactly like `src/main.ts`.
 *
 * Keeping the wiring in one place is what makes the e2e suite meaningful: a prefix or auth
 * change that is only applied in `main.ts` would otherwise pass every test and still break
 * in production.
 *
 * @returns Initialised application, ready for `app.inject`.
 */
export async function createTestApp(): Promise<NestFastifyApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({
      logger: false,
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  const globalPrefix = buildApiPrefix(process.env.BASE_PATH);
  app.setGlobalPrefix(globalPrefix);

  // Credentials come from the config, exactly as in main.ts. Re-parsing the environment here
  // would let a parsing change pass the whole suite and still break in production.
  const config = app.get(ConfigService).getOrThrow<AppConfig>('app');

  registerAuthHook(app.getHttpAdapter().getInstance(), {
    basicUser: config.authBasicUser,
    basicPass: config.authBasicPass,
    bearerTokens: config.authBearerTokens,
    publicPaths: [`${globalPrefix}/health`],
  });

  app.enableShutdownHooks();

  await app.init();
  // Fastify registers plugins asynchronously; without this the first inject can 404.
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
