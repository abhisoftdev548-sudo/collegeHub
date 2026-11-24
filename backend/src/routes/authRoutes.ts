import { Router } from 'express';
import * as controller from '../controllers/authController';
import { asyncHandler } from '../utils/errors';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { loginSchema, changePasswordSchema, updateProfileSchema, registerSelfSchema } from '../validators/authValidators';
import { authLimiter, sensitiveLimiter } from '../middleware/rateLimits';

const router = Router();

router.get('/csrf', asyncHandler(controller.csrf));
router.post('/login', authLimiter, validate({ body: loginSchema }), asyncHandler(controller.login));
router.post('/logout', asyncHandler(controller.logout));
router.post('/refresh', asyncHandler(controller.refresh));
router.post(
  '/register',
  sensitiveLimiter,
  validate({ body: registerSelfSchema }),
  asyncHandler(controller.register),
);
router.get('/me', requireAuth, asyncHandler(controller.me));
router.patch(
  '/me',
  requireAuth,
  validate({ body: updateProfileSchema }),
  asyncHandler(controller.updateProfile),
);
router.post(
  '/change-password',
  requireAuth,
  authLimiter,
  validate({ body: changePasswordSchema }),
  asyncHandler(controller.changePassword),
);

export default router;
