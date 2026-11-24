import { Router } from 'express';
import { z } from 'zod';
import * as controller from '../controllers/miscController';
import { asyncHandler } from '../utils/errors';
import { requireAuth } from '../middleware/auth';
import { requireAnyPermission, requirePermission } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { ANNOUNCEMENT_AUDIENCES } from '../config/constants';
import { objectId } from '../validators/common';

const announcementCreateSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    body: z.string().trim().min(3).max(5000),
    audience: z.enum(ANNOUNCEMENT_AUDIENCES as [string, ...string[]]),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
    department: z.union([objectId(), z.literal('')]).optional(),
    course: z.union([objectId(), z.literal('')]).optional(),
    semester: z.union([objectId(), z.literal('')]).optional(),
    section: z.union([objectId(), z.literal('')]).optional(),
    event: z.union([objectId(), z.literal('')]).optional(),
    volunteerGroup: z.union([objectId(), z.literal('')]).optional(),
    published: z.boolean().optional(),
    publishAt: z.string().optional(),
    expiresAt: z.string().optional(),
  })
  .strict();

const settingsUpdateSchema = z
  .object({
    collegeName: z.string().trim().max(200).optional(),
    collegeEmail: z.string().trim().max(160).optional(),
    collegePhone: z.string().trim().max(30).optional(),
    address: z.string().trim().max(500).optional(),
    allowSelfRegistration: z.boolean().optional(),
    maintenanceMode: z.boolean().optional(),
    announcementBanner: z.string().trim().max(300).optional(),
    socialLinks: z
      .object({
        website: z.string().trim().max(200).optional(),
        instagram: z.string().trim().max(200).optional(),
        youtube: z.string().trim().max(200).optional(),
      })
      .optional(),
    paymentConfig: z
      .object({
        gatewayEnabled: z.boolean().optional(),
        razorpayKeyId: z.string().trim().max(120).optional(),
        paymentInstructions: z.string().trim().max(2000).optional(),
      })
      .optional(),
  })
  .strict();

export const announcementRouter = Router();
announcementRouter.use(requireAuth);
announcementRouter.get('/', requireAnyPermission('announcement:manage'), asyncHandler(controller.listAnnouncements));
announcementRouter.get('/me', asyncHandler(controller.myAnnouncements));
announcementRouter.get('/audiences', asyncHandler(controller.announcementAudiences));
announcementRouter.post('/', requireAnyPermission('announcement:manage', 'event:update'), validate({ body: announcementCreateSchema }), asyncHandler(controller.createAnnouncement));
announcementRouter.patch('/:id', requireAnyPermission('announcement:manage'), asyncHandler(controller.updateAnnouncement));
announcementRouter.delete('/:id', requireAnyPermission('announcement:manage'), asyncHandler(controller.deleteAnnouncement));
announcementRouter.post('/:id/read', asyncHandler(controller.markAnnouncementRead));

export const notificationRouter = Router();
notificationRouter.use(requireAuth);
notificationRouter.get('/', asyncHandler(controller.listNotifications));
notificationRouter.post('/read', asyncHandler(controller.markNotificationsRead));

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);
dashboardRouter.get('/', asyncHandler(controller.dashboard));

export const reportRouter = Router();
reportRouter.use(requireAuth);
reportRouter.use(requirePermission('report:read'));
reportRouter.get('/academic', asyncHandler(controller.academicReport));
reportRouter.get('/academic/export', asyncHandler(controller.exportAcademicReport));
reportRouter.get('/teacher-workload', asyncHandler(controller.teacherWorkload));
reportRouter.get('/engagement', asyncHandler(controller.engagement));
reportRouter.get('/student-activity', asyncHandler(controller.studentActivity));
reportRouter.get('/audit-logs', asyncHandler(controller.auditLogs));

export const settingsRouter = Router();
settingsRouter.get('/public', asyncHandler(controller.getPublicSettings));
settingsRouter.get('/', requireAuth, requirePermission('settings:manage'), asyncHandler(controller.getSettings));
settingsRouter.patch('/', requireAuth, requirePermission('settings:manage'), validate({ body: settingsUpdateSchema }), asyncHandler(controller.updateSettings));

export const searchRouter = Router();
searchRouter.use(requireAuth);
searchRouter.get('/', asyncHandler(controller.globalSearch));
