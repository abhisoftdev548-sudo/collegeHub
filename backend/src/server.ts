import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './config/db';
import { env } from './config/env';
import { logger } from './config/logger';
import { ensurePlatformSettings } from './services/settingsService';

/**
 * Process entrypoint: connect to MongoDB, then listen on 0.0.0.0:$PORT.
 * Graceful shutdown releases DB connections cleanly (Render sends SIGTERM).
 */
const start = async (): Promise<void> => {
  await connectDatabase();
  await ensurePlatformSettings();

  const app = createApp();
  const server = app.listen(env.port, '0.0.0.0', () => {
    logger.info({ port: env.port, env: env.nodeEnv }, 'CollegeHub server started');
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down gracefully');
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'Unhandled promise rejection');
  });
};

start().catch((error) => {
  logger.error({ err: error }, 'Failed to start server');
  process.exit(1);
});
