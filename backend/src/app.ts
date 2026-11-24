import path from 'node:path';
import fs from 'node:fs';
import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { csrfProtection } from './middleware/csrf';
import { apiLimiter } from './middleware/rateLimits';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { isDatabaseConnected } from './config/db';
import { httpLogger } from './middleware/requestLogger';
import apiRouter from './routes';

/**
 * Builds the Express application.
 *
 * Responsibilities:
 *  - security middleware (helmet, CORS, CSRF, rate limiting)
 *  - `/api/*` JSON API
 *  - `/uploads/*` user media (with hardened headers)
 *  - static serving of the exported Next.js frontend + SPA fallback
 */
export const createApp = (): Express => {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: false, // static export ships inline hydration data; CSP handled at header level below
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  const allowedOrigins = new Set([
    ...env.corsOrigins,
    'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5000',
  ]);

  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin requests (no Origin header) and configured origins only.
        if (!origin || allowedOrigins.has(origin)) return callback(null, true);
        return callback(null, false);
      },
      credentials: true,
    }),
  );

  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(httpLogger);

  // CSRF applies to state-changing API calls only.
  app.use('/api', (req, res, next) => {
    if (req.path === '/health') return next();
    return csrfProtection(req, res, next);
  });

  // Health endpoint: fast, unauthenticated, no database work.
  app.get('/api/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      database: isDatabaseConnected() ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api', apiLimiter, apiRouter);

  // User uploads (served with safe content handling).
  const uploadPath = path.resolve(process.cwd(), env.uploadDir);
  fs.mkdirSync(uploadPath, { recursive: true });
  app.use(
    '/uploads',
    express.static(uploadPath, {
      maxAge: '7d',
      setHeaders(res) {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'");
        res.setHeader('Cache-Control', 'public, max-age=604800');
      },
    }),
  );

  // ---- Static frontend (Next.js static export copied to backend/public) ----
  const publicDir = path.resolve(__dirname, '..', 'public');
  const indexHtml = path.join(publicDir, 'index.html');

  // Resolved per request: the static export may be copied in after the server
  // has already booted (deploys, `npm run build` while `npm run dev` runs).

  /**
   * Next.js exports a page and a sibling directory with the same name when the
   * route has nested pages (e.g. `dashboard/explore.html` + `dashboard/explore/`
   * holding `detail.html`). Express's static middleware would 301 into the
   * directory and then miss `index.html`. Resolve `<path>.html` first so the
   * page itself is always served, without a redirect.
   */
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const requestPath = req.path;
    if (
      requestPath === '/' ||
      requestPath.startsWith('/api') ||
      requestPath.startsWith('/uploads') ||
      path.extname(requestPath) !== ''
    ) {
      return next();
    }
    const candidate = path.resolve(publicDir, `.${requestPath}.html`);
    // Guard against path traversal through encoded separators.
    if (!candidate.startsWith(`${publicDir}${path.sep}`) || !fs.existsSync(candidate)) return next();
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    return res.sendFile(candidate);
  });

  app.use(
    express.static(publicDir, {
      index: 'index.html',
      // Next exports /about as about.html — resolve extensionless routes to it.
      extensions: ['html'],
      maxAge: '1y',
      immutable: true,
      setHeaders(res, filePath) {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        }
      },
    }),
  );

  // SPA fallback: serve the shell for client-side routes, never for /api or missing assets.
  app.get('*', (req, res, next) => {
    const requestPath = req.path;
    if (
      requestPath.startsWith('/api') ||
      requestPath.startsWith('/uploads') ||
      path.extname(requestPath) !== ''
    ) {
      return next();
    }
    if (!fs.existsSync(indexHtml)) {
      return res.status(200).json({
        success: true,
        message: 'CollegeHub API is running. The frontend build was not found in backend/public.',
      });
    }
    return res.sendFile(indexHtml);
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
