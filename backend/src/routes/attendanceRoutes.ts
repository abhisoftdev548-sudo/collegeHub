import { Router } from 'express';
import { z } from 'zod';
import * as controller from '../controllers/attendanceController';
import { asyncHandler } from '../utils/errors';
import { requireAuth } from '../middleware/auth';
import { requireAnyPermission, requirePermission, requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { objectId } from '../validators/common';

const saveSchema = z
  .object({
    subject: objectId(),
    section: objectId(),
    date: z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Enter a valid date'),
    records: z
      .array(
        z.object({
          studentId: objectId(),
          status: z.enum(['present', 'absent', 'late']),
          remarks: z.string().trim().max(200).optional(),
        }),
      )
      .min(1)
      .max(500),
  })
  .strict();

const eventCheckInSchema = z
  .object({
    registrationId: objectId().optional(),
    studentId: objectId().optional(),
    notes: z.string().trim().max(300).optional(),
  })
  .strict()
  .refine((value) => value.registrationId || value.studentId, { message: 'Provide a registration or student' });

export const attendanceRouter = Router();
attendanceRouter.use(requireAuth);

attendanceRouter.get('/sheet', requireRole('teacher', 'admin'), asyncHandler(controller.sheet));
attendanceRouter.get('/roster', requireAnyPermission('attendance:manage', 'student:read'), asyncHandler(controller.roster));
attendanceRouter.post('/', requirePermission('attendance:manage'), validate({ body: saveSchema }), asyncHandler(controller.save));
attendanceRouter.get('/history', requireAnyPermission('attendance:read', 'attendance:manage'), asyncHandler(controller.history));
attendanceRouter.get('/report', requireAnyPermission('attendance:read', 'attendance:manage'), asyncHandler(controller.report));
attendanceRouter.get('/report/export', requireAnyPermission('attendance:read', 'attendance:manage'), asyncHandler(controller.exportReport));
attendanceRouter.get('/me', asyncHandler(controller.myAttendance));

export const eventAttendanceRouter = Router();
eventAttendanceRouter.use(requireAuth);
eventAttendanceRouter.get('/me', asyncHandler(controller.myCheckIns));
eventAttendanceRouter.get('/:eventId', requireAnyPermission('attendance:read', 'event:update'), asyncHandler(controller.eventOverview));
eventAttendanceRouter.post('/:eventId/check-in', requireAnyPermission('attendance:manage', 'event:update', 'event:manage_volunteers'), validate({ body: eventCheckInSchema }), asyncHandler(controller.checkIn));
eventAttendanceRouter.post(
  '/:eventId/check-in/qr',
  requireAnyPermission('attendance:manage', 'event:update', 'event:manage_volunteers'),
  validate({ body: z.object({ code: z.string().trim().min(4).max(60) }).strict() }),
  asyncHandler(controller.checkInQr),
);
eventAttendanceRouter.post(
  '/:eventId/check-in/staff',
  requireAnyPermission('attendance:manage', 'event:update', 'event:manage_volunteers'),
  validate({ body: z.object({ userId: objectId(), role: z.enum(['volunteer', 'teacher']) }).strict() }),
  asyncHandler(controller.checkInStaff),
);
