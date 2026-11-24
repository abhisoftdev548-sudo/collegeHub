import rateLimit from 'express-rate-limit';

const standard = {
  standardHeaders: true as const,
  legacyHeaders: false as const,
};

/** Authentication endpoints: strict. */
export const authLimiter = rateLimit({
  ...standard,
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again in a few minutes.' } },
});

/** Password reset / bootstrap style endpoints: very strict. */
export const sensitiveLimiter = rateLimit({
  ...standard,
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again later.' } },
});

/** General API protection. */
export const apiLimiter = rateLimit({
  ...standard,
  windowMs: 60 * 1000,
  limit: 300,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' } },
});
