import { Router } from 'express';
import { z } from 'zod';
import * as controller from '../controllers/volunteerController';
import { asyncHandler } from '../utils/errors';
import { requireAuth } from '../middleware/auth';
import { requireAnyPermission } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { objectId } from '../validators/common';

const groupSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    event: objectId(),
    description: z.string().trim().max(1000).optional(),
    coordinator: objectId().optional(),
  })
  .strict();

const taskSchema = z
  .object({
    title: z.string().trim().min(2).max(200),
    description: z.string().trim().max(2000).optional(),
    event: objectId(),
    group: objectId().optional(),
    assignedTo: z.array(objectId()).max(50).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    dueDate: z.string().optional(),
  })
  .strict();

const taskUpdateSchema = z
  .object({
    status: z.enum(['pending', 'in_progress', 'completed', 'blocked']).optional(),
    note: z.string().trim().max(500).optional(),
    title: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(2000).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    dueDate: z.string().optional(),
    assignedTo: z.array(objectId()).max(50).optional(),
    group: objectId().optional(),
  })
  .strict();

export const volunteerRouter = Router();
volunteerRouter.use(requireAuth);
volunteerRouter.get('/groups', asyncHandler(controller.listGroups));
volunteerRouter.get('/my-groups', asyncHandler(controller.myGroups));
volunteerRouter.post('/groups', requireAnyPermission('event:manage_volunteers', 'event:update'), validate({ body: groupSchema }), asyncHandler(controller.createGroup));
volunteerRouter.patch('/groups/:id', requireAnyPermission('event:manage_volunteers', 'event:update'), asyncHandler(controller.updateGroup));
volunteerRouter.delete('/groups/:id', requireAnyPermission('event:manage_volunteers', 'event:update'), asyncHandler(controller.removeGroup));
volunteerRouter.post(
  '/groups/:id/volunteers',
  requireAnyPermission('event:manage_volunteers', 'event:update'),
  validate({ body: z.object({ studentId: objectId(), asLeader: z.boolean().optional() }).strict() }),
  asyncHandler(controller.assign),
);
volunteerRouter.delete('/groups/:id/volunteers/:studentId', requireAnyPermission('event:manage_volunteers', 'event:update'), asyncHandler(controller.unassign));

export const taskRouter = Router();
taskRouter.use(requireAuth);
taskRouter.get('/', asyncHandler(controller.listTasks));
taskRouter.get('/my', asyncHandler(controller.myTasks));
taskRouter.post('/', requireAnyPermission('task:manage', 'event:manage_volunteers'), validate({ body: taskSchema }), asyncHandler(controller.createTask));
taskRouter.patch('/:id', validate({ body: taskUpdateSchema }), asyncHandler(controller.updateTask));
taskRouter.delete('/:id', requireAnyPermission('task:manage', 'event:update'), asyncHandler(controller.removeTask));

export default volunteerRouter;
