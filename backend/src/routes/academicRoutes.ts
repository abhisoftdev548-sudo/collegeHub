import { Router } from 'express';
import * as controller from '../controllers/academicController';
import { asyncHandler } from '../utils/errors';
import { requireAuth } from '../middleware/auth';
import { requireAnyPermission, requirePermission } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import {
  academicListQuery,
  courseCreateSchema,
  courseUpdateSchema,
  crAssignSchema,
  departmentCreateSchema,
  departmentUpdateSchema,
  semesterGenerateSchema,
  sectionCreateSchema,
  sectionUpdateSchema,
  sessionCreateSchema,
  sessionUpdateSchema,
  subjectCreateSchema,
  subjectUpdateSchema,
  teachingAssignmentCreateSchema,
} from '../validators/academicValidators';

const router = Router();
router.use(requireAuth);

/* Academic sessions */
router.get('/sessions', requirePermission('session:manage'), asyncHandler(controller.listSessions));
router.post('/sessions', requirePermission('session:manage'), validate({ body: sessionCreateSchema }), asyncHandler(controller.createSession));
router.patch('/sessions/:id', requirePermission('session:manage'), validate({ body: sessionUpdateSchema }), asyncHandler(controller.updateSession));
router.post('/sessions/:id/current', requirePermission('session:manage'), asyncHandler(controller.setCurrentSession));

/* Departments */
router.get('/departments', asyncHandler(controller.listDepartments));
router.get('/departments/:id', asyncHandler(controller.getDepartment));
router.post('/departments', requirePermission('department:manage'), validate({ body: departmentCreateSchema }), asyncHandler(controller.createDepartment));
router.patch('/departments/:id', requirePermission('department:manage'), validate({ body: departmentUpdateSchema }), asyncHandler(controller.updateDepartment));
router.delete('/departments/:id', requirePermission('department:manage'), asyncHandler(controller.deleteDepartment));

/* Courses */
router.get('/courses', asyncHandler(controller.listCourses));
router.post('/courses', requirePermission('course:manage'), validate({ body: courseCreateSchema }), asyncHandler(controller.createCourse));
router.patch('/courses/:id', requirePermission('course:manage'), validate({ body: courseUpdateSchema }), asyncHandler(controller.updateCourse));
router.delete('/courses/:id', requirePermission('course:manage'), asyncHandler(controller.deleteCourse));

/* Semesters */
router.get('/semesters', asyncHandler(controller.listSemesters));
router.post('/semesters/generate', requirePermission('session:manage'), validate({ body: semesterGenerateSchema }), asyncHandler(controller.generateSemesters));
router.delete('/semesters/:id', requirePermission('session:manage'), asyncHandler(controller.deleteSemester));

/* Sections */
router.get('/sections', asyncHandler(controller.listSections));
router.post('/sections', requirePermission('section:manage'), validate({ body: sectionCreateSchema }), asyncHandler(controller.createSection));
router.patch('/sections/:id', requireAnyPermission('section:manage', 'subject:manage'), validate({ body: sectionUpdateSchema }), asyncHandler(controller.updateSection));
router.delete('/sections/:id', requirePermission('section:manage'), asyncHandler(controller.deleteSection));

/* Subjects */
router.get('/subjects', asyncHandler(controller.listSubjects));
router.post('/subjects', requireAnyPermission('subject:manage', 'department:manage'), validate({ body: subjectCreateSchema }), asyncHandler(controller.createSubject));
router.patch('/subjects/:id', requireAnyPermission('subject:manage', 'department:manage'), validate({ body: subjectUpdateSchema }), asyncHandler(controller.updateSubject));
router.delete('/subjects/:id', requirePermission('subject:manage'), asyncHandler(controller.deleteSubject));

/* Teaching assignments */
router.get('/teaching-assignments', asyncHandler(controller.listTeachingAssignments));
router.post(
  '/teaching-assignments',
  requireAnyPermission('section:manage', 'subject:manage'),
  validate({ body: teachingAssignmentCreateSchema }),
  asyncHandler(controller.createTeachingAssignment),
);
router.delete('/teaching-assignments/:id', requireAnyPermission('section:manage', 'subject:manage'), asyncHandler(controller.removeTeachingAssignment));

/* Class representatives */
router.get('/class-representatives', asyncHandler(controller.listClassRepresentatives));
router.post('/class-representatives', requirePermission('cr:assign'), validate({ body: crAssignSchema }), asyncHandler(controller.assignClassRepresentative));
router.delete('/class-representatives/:studentId/:sectionId', requirePermission('cr:assign'), asyncHandler(controller.removeClassRepresentative));

export default router;
