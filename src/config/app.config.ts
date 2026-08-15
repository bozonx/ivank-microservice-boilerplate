import { registerAs } from '@nestjs/config';
import { IsBoolean, IsInt, IsString, IsIn, Min, Max, validateSync } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { normalizeBasePath } from '../common/http/api-prefix.js';

export class AppConfig {
  @IsInt()
  @Min(1)
  @Max(65535)
  public port!: number;

  @IsString()
  public host!: string;

  @IsString()
  public basePath!: string;

  @IsIn(['development', 'production', 'test'])
  public nodeEnv!: string;

  // Allow only Pino log levels
  @IsIn(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
  public logLevel!: string;

  /** Basic auth user. Empty when Basic auth is not configured. */
  @IsString()
  public authBasicUser!: string;

  /** Basic auth password. Empty when Basic auth is not configured. */
  @IsString()
  public authBasicPass!: string;

  /** Accepted Bearer tokens. Empty when Bearer auth is not configured. */
  public authBearerTokens!: string[];

  /** True when any authentication method is configured. */
  @IsBoolean()
  public authEnabled!: boolean;

  /**
   * Seconds to keep serving after SIGTERM while health already reports `shutting_down`.
   * Gives the load balancer time to notice and stop routing here. 0 shuts down at once.
   */
  @IsInt()
  @Min(0)
  @Max(300)
  public shutdownDrainSeconds!: number;
}

/**
 * Parses a comma-separated token list, dropping empty entries.
 *
 * @param raw - Raw environment value.
 * @returns Trimmed, non-empty tokens.
 */
function parseTokens(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map(token => token.trim())
    .filter(token => token.length > 0);
}

export default registerAs('app', (): AppConfig => {
  const authBasicUser = (process.env.AUTH_BASIC_USER ?? '').trim();
  const authBasicPass = (process.env.AUTH_BASIC_PASS ?? '').trim();
  const authBearerTokens = parseTokens(process.env.AUTH_BEARER_TOKENS);

  const config = plainToClass(AppConfig, {
    port: parseInt(process.env.LISTEN_PORT ?? '8080', 10),
    host: process.env.LISTEN_HOST ?? '0.0.0.0',
    basePath: normalizeBasePath(process.env.BASE_PATH),
    nodeEnv: process.env.NODE_ENV ?? 'production',
    logLevel: process.env.LOG_LEVEL ?? 'warn',
    authBasicUser,
    authBasicPass,
    authBearerTokens,
    // Basic auth needs both halves; a half-configured pair is a mistake, not a setup.
    authEnabled: (authBasicUser !== '' && authBasicPass !== '') || authBearerTokens.length > 0,
    shutdownDrainSeconds: parseInt(process.env.SHUTDOWN_DRAIN_SECONDS ?? '5', 10),
  });

  const errors = validateSync(config, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors.map(err => Object.values(err.constraints ?? {}).join(', '));
    throw new Error(`App config validation error: ${errorMessages.join('; ')}`);
  }

  if ((authBasicUser === '') !== (authBasicPass === '')) {
    throw new Error(
      'App config validation error: AUTH_BASIC_USER and AUTH_BASIC_PASS must be set together',
    );
  }

  return config;
});
