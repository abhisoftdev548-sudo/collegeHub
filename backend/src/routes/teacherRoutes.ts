import { Router } from 'express';
import * as controller from '../controllers/teacherController';
import { asyncHandler } from '../utils/errors';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { teacherCreateSchema, teacherListSchema, teacherUpdateSchema } from '../validators/peopleValidators';

const router = Router();
router.use(requireAuth);

router.get('/', requirePermission('teacher:manage'), validate({ query: teacherListSchema }), asyncHandler(controller.list));
router.post('/', requirePermission('teacher:manage'), validate({ body: teacherCreateSchema }), asyncHandler(controller.create));
router.get('/me/overview', asyncHandler(controller.myOverview));
router.get('/me/students', asyncHandler(controller.myStudents));
router.patch('/:id', requirePermission('teacher:manage'), validate({ body: teacherUpdateSchema }), asyncHandler(controller.update));
router.post('/:id/suspension', requirePermission('teacher:manage'), asyncHandler(controller.setSuspension));
router.post('/:id/reset-password', requirePermission('teacher:manage'), asyncHandler(controller.resetPassword));

export default router;
