import { Router } from 'express';
import * as controller from '../controllers/eventController';
import { asyncHandler } from '../utils/errors';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { requireAnyPermission, requirePermission } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { uploadSingle } from '../middleware/upload';
import {
  categoryCreateSchema,
  eventCreateSchema,
  eventUpdateSchema,
  formCreateSchema,
  formUpdateSchema,
  paymentReferenceSchema,
  paymentVerifySchema,
  registrationCreateSchema,
  registrationStatusSchema,
} from '../validators/eventValidators';

const router = Router();

/* Public browsing */
router.get('/', optionalAuth, asyncHandler(controller.list));
router.get('/categories', asyncHandler(controller.listCategories));
router.get('/my-registrations', requireAuth, asyncHandler(controller.myRegistrations));
router.get('/my-payments', requireAuth, asyncHandler(controller.myPayments));

/* Forms (auth required for management, public read by id for rendering) */
router.get('/forms', requireAuth, asyncHandler(controller.listForms));
router.get('/forms/:id', requireAuth, asyncHandler(controller.getForm));
router.post('/forms', requireAuth, requireAnyPermission('form:manage', 'competition:manage'), validate({ body: formCreateSchema }), asyncHandler(controller.createForm));
router.patch('/forms/:id', requireAuth, requireAnyPermission('form:manage', 'competition:manage'), validate({ body: formUpdateSchema }), asyncHandler(controller.updateForm));
router.delete('/forms/:id', requireAuth, requireAnyPermission('form:manage', 'competition:manage'), asyncHandler(controller.deleteForm));

/* Payments */
router.post('/payments/order', requireAuth, asyncHandler(controller.createPaymentOrder));
router.post('/payments/:paymentId/reference', requireAuth, validate({ body: paymentReferenceSchema }), asyncHandler(controller.submitPaymentReference));
router.post('/payments/:paymentId/verify', requireAuth, requirePermission('payment:manage'), validate({ body: paymentVerifySchema }), asyncHandler(controller.verifyPayment));
router.post('/payments/gateway/callback', requireAuth, asyncHandler(controller.gatewayCallback));
router.get('/payments', requireAuth, requirePermission('payment:manage'), asyncHandler(controller.listPayments));

/* Uploads */
router.post('/uploads', requireAuth, uploadSingle, asyncHandler(controller.uploadFile));

/* Categories management */
router.post('/categories', requireAuth, requireAnyPermission('event:create', 'event:update'), validate({ body: categoryCreateSchema }), asyncHandler(controller.createCategory));
router.patch('/categories/:id', requireAuth, requirePermission('event:update'), asyncHandler(controller.updateCategory));

/* Registration admin */
router.get('/registrations/:eventId', requireAuth, requireAnyPermission('registration:read', 'event:update'), asyncHandler(controller.listRegistrations));
router.patch('/registrations/:eventId/:registrationId', requireAuth, requireAnyPermission('registration:read', 'event:update'), validate({ body: registrationStatusSchema }), asyncHandler(controller.updateRegistrationStatus));

/* Event detail + management */
router.get('/:id', optionalAuth, asyncHandler(controller.getById));
router.get('/:id/registrations', requireAuth, requireAnyPermission('registration:read', 'event:update'), asyncHandler(controller.listRegistrations));
router.get('/:id/registrations/export', requireAuth, requireAnyPermission('registration:read', 'event:update'), asyncHandler(controller.exportRegistrations));
router.get('/:id/report', requireAuth, requirePermission('report:read'), asyncHandler(controller.eventReport));
router.post('/:id/register', requireAuth, validate({ body: registrationCreateSchema }), asyncHandler(controller.register));
router.post('/', requireAuth, requirePermission('event:create'), validate({ body: eventCreateSchema }), asyncHandler(controller.create));
router.patch('/:id', requireAuth, requireAnyPermission('event:update', 'event:create'), validate({ body: eventUpdateSchema }), asyncHandler(controller.update));
router.delete('/:id', requireAuth, requirePermission('event:update'), asyncHandler(controller.remove));

export default router;
