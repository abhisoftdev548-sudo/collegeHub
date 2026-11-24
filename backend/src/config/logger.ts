import pino from 'pino';
import { env } from './env';

/**
 * Structured application logger. Machine-readable JSON in every environment
 * (Render captures stdout), with request logging kept concise in the
 * middleware instead of dumping headers.
 */
export const logger = pino({
  level: env.isProduction ? 'info' : 'debug',
  redact: {
    paths: ['req.headers.cookie', 'req.headers.authorization', '*.password', '*.passwordHash'],
    censor: '[redacted]',
  },
});
