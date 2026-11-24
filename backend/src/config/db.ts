import mongoose from 'mongoose';
import { env } from './env';
import { logger } from './logger';

/**
 * Establishes the MongoDB connection with production-safe defaults.
 * Index creation is delegated to models; Mongoose autoIndex is enabled only
 * outside production (in production indexes are expected to already exist and
 * are created idempotently at startup by calling syncIndexes in deployment).
 */
export const connectDatabase = async (): Promise<void> => {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected', () => logger.info('MongoDB connected'));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('error', (error) => logger.error({ err: error }, 'MongoDB connection error'));

  await mongoose.connect(env.mongodbUri, {
    serverSelectionTimeoutMS: 15000,
    maxPoolSize: 20,
    autoIndex: !env.isProduction,
  });
};

export const disconnectDatabase = async (): Promise<void> => {
  await mongoose.disconnect();
};

export const isDatabaseConnected = (): boolean => mongoose.connection.readyState === 1;
