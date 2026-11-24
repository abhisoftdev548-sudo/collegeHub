import { Router } from 'express';
import * as controller from '../controllers/competitionController';
import { asyncHandler } from '../utils/errors';
import { requireAuth } from '../middleware/auth';
import { requireAnyPermission, requirePermission } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import {
  competitionCreateSchema,
  competitionUpdateSchema,
  resultSchema,
  submissionCreateSchema,
  submissionReviewSchema,
} from '../validators/competitionValidators';

const router = Router();
router.use(requireAuth);

router.get('/', requireAnyPermission('competition:manage', 'event:read'), asyncHandler(controller.list));
router.get('/my-submissions', asyncHandler(controller.mySubmissions));
router.get('/my-results', asyncHandler(controller.myResults));
router.post('/', requireAnyPermission('competition:manage', 'event:update'), validate({ body: competitionCreateSchema }), asyncHandler(controller.create));
router.get('/:id', asyncHandler(controller.getById));
router.patch('/:id', requireAnyPermission('competition:manage', 'event:update'), validate({ body: competitionUpdateSchema }), asyncHandler(controller.update));
router.delete('/:id', requireAnyPermission('competition:manage', 'event:update'), asyncHandler(controller.remove));
router.post('/:id/submissions', validate({ body: submissionCreateSchema }), asyncHandler(controller.submit));
router.patch('/submissions/:submissionId/review', requirePermission('submission:review'), validate({ body: submissionReviewSchema }), asyncHandler(controller.review));
router.post('/:id/results', requireAnyPermission('competition:manage', 'event:update'), validate({ body: resultSchema }), asyncHandler(controller.declareResult));
router.post('/:id/publish', requireAnyPermission('competition:manage', 'event:update'), asyncHandler(controller.publishResults));

export default router;
