import { Test } from '@nestjs/testing';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../../src/app.module.js';
import { configureApp, createFastifyAdapter } from '../../src/configure-app.js';

/**
 * Builds an app instance wired exactly like `src/main.ts`.
 *
 * Both go through `configureApp`, which is what makes the e2e suite meaningful: a prefix or
 * auth change applied in only one of the two would otherwise pass every test and still break
 * in production.
 *
 * @returns Initialised application, ready for `app.inject`.
 */
export async function createTestApp(): Promise<NestFastifyApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(createFastifyAdapter());

  configureApp(app);
  app.enableShutdownHooks();

  await app.init();
  // Fastify registers plugins asynchronously; without this the first inject can 404.
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
