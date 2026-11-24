import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';

export const env = {
  nodeEnv,
  isProduction,
  isTest: nodeEnv === 'test',
  port: Number(process.env.PORT ?? 5000),

  mongodbUri: required('MONGODB_URI', 'mongodb://127.0.0.1:27017/collegehub'),

  jwtAccessSecret: required('JWT_ACCESS_SECRET', isProduction ? undefined : 'dev-access-secret-change-me'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET', isProduction ? undefined : 'dev-refresh-secret-change-me'),
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? '15m',
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 7),

  cookieSecure: bool('COOKIE_SECURE', isProduction),
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB ?? 10),

  adminName: process.env.ADMIN_NAME ?? 'College Administrator',
  adminEmail: process.env.ADMIN_EMAIL ?? 'admin@pdpscollege.edu.in',
  adminPassword: process.env.ADMIN_PASSWORD ?? '',
  seedDemoData: bool('SEED_DEMO_DATA', false),
} as const;

export const isProd = env.isProduction;
