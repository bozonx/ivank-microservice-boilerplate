import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { HealthModule } from './modules/health/health.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import appConfig from './config/app.config.js';
import type { AppConfig } from './config/app.config.js';
import { SERVICE_NAME, SERVICE_VERSION } from './config/service-info.js';
import { buildApiPrefix } from './common/http/api-prefix.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      // One env file. In containers the environment comes from the orchestrator and no
      // file is read at all.
      envFilePath: ['.env'],
      cache: true,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const config = configService.get<AppConfig>('app');
        if (!config) {
          throw new Error('App configuration is missing; check config registration in AppModule');
        }
        const isDev = config.nodeEnv === 'development';
        const healthPath = `/${buildApiPrefix(config.basePath)}/health`;

        return {
          pinoHttp: {
            level: config.logLevel,
            timestamp: () => `,"@timestamp":"${new Date().toISOString()}"`,
            base: {
              service: SERVICE_NAME,
              version: SERVICE_VERSION,
              environment: config.nodeEnv,
            },
            transport: isDev
              ? {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    singleLine: false,
                    translateTime: "UTC:yyyy-mm-dd'T'HH:MM:ss.l'Z'",
                    ignore: 'pid,hostname',
                    messageFormat: '[{context}] {msg}',
                  },
                }
              : undefined,
            serializers: {
              req: req => ({
                id: req.id,
                method: req.method,
                url: req.url,
                path: req.url?.split('?')[0],
                remoteAddress: req.ip,
                remotePort: req.socket?.remotePort,
              }),
              res: res => ({
                statusCode: res.statusCode,
              }),
              err: err => ({
                type: err.type,
                message: err.message,
                stack: err.stack,
              }),
            },
            // Emitted through customProps rather than the `req` serializer: Pino serializes the
            // request bindings when the child logger is created, which can be before the auth
            // hook has identified the caller. customProps runs when the line is written.
            customProps: req => ({
              client: (req as unknown as { authClient?: string }).authClient,
            }),
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers["x-api-key"]',
                'req.headers.cookie',
              ],
              censor: '[REDACTED]',
            },
            customLogLevel: (req, res, err) => {
              if (res.statusCode >= 500 || err) {
                return 'error';
              }
              if (res.statusCode >= 400) {
                return 'warn';
              }
              return 'info';
            },
            autoLogging: {
              // Health is polled every few seconds; logging it in production is pure noise.
              ignore: req =>
                config.nodeEnv === 'production' && (req.url?.split('?')[0] ?? '') === healthPath,
            },
          },
        };
      },
    }),
    HealthModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
