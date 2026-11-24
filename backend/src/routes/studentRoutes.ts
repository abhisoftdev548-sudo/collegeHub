import { Router } from 'express';
import * as controller from '../controllers/studentController';
import { asyncHandler } from '../utils/errors';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import {
  placementCorrectionSchema,
  promotionCreateSchema,
  promotionPreviewSchema,
  studentCreateSchema,
  studentListSchema,
  studentUpdateSchema,
} from '../validators/peopleValidators';

const router = Router();
router.use(requireAuth);

router.get('/', requirePermission('student:read'), validate({ query: studentListSchema }), asyncHandler(controller.list));
router.get('/export', requirePermission('student:read'), asyncHandler(controller.exportCsv));
router.get('/import-template', requirePermission('student:create'), asyncHandler(controller.importTemplate));
router.post('/import', requirePermission('student:create'), asyncHandler(controller.importCsv));
router.get('/:id', requirePermission('student:read'), asyncHandler(controller.getById));
router.get('/:id/history', requirePermission('student:read'), asyncHandler(controller.getHistory));
router.post('/', requirePermission('student:create'), validate({ body: studentCreateSchema }), asyncHandler(controller.create));
router.patch('/:id', requirePermission('student:update'), validate({ body: studentUpdateSchema }), asyncHandler(controller.update));
router.post('/:id/status', requirePermission('student:update'), asyncHandler(controller.setStatus));
router.post('/:id/reset-password', requirePermission('student:update'), asyncHandler(controller.resetPassword));
router.patch(
  '/:id/placement',
  requirePermission('student:promote'),
  validate({ body: placementCorrectionSchema }),
  asyncHandler(controller.placementCorrection),
);

export const promotionRouter = Router();
promotionRouter.use(requireAuth);
promotionRouter.post('/preview', requirePermission('student:promote'), validate({ body: promotionPreviewSchema }), asyncHandler(controller.promotionPreview));
promotionRouter.post('/', requirePermission('student:promote'), validate({ body: promotionCreateSchema }), asyncHandler(controller.promotionCreate));
promotionRouter.get('/', requirePermission('student:promote'), asyncHandler(controller.promotionList));
promotionRouter.get('/:id', requirePermission('student:promote'), asyncHandler(controller.promotionGet));
promotionRouter.post('/:id/approve', requirePermission('student:promote'), asyncHandler(controller.promotionApprove));
promotionRouter.post('/:id/cancel', requirePermission('student:promote'), asyncHandler(controller.promotionCancel));

export default router;
