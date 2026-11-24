import type { Request, Response } from 'express';
import * as service from '../services/academicService';
import { created, ok, param } from '../utils/apiResponse';
import { recordAudit } from '../utils/audit';
import { UnauthorizedError } from '../utils/errors';

/* Sessions */
export const listSessions = async (_req: Request, res: Response) => ok(res, await service.listSessions());

export const createSession = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const session = await service.createSession({ ...req.body, createdBy: req.user.id });
  recordAudit(req, { action: 'session.created', entity: 'AcademicSession', entityId: session._id, description: session.name });
  return created(res, session, 'Academic session created');
};

export const updateSession = async (req: Request, res: Response) => {
  const session = await service.updateSession(param(req, 'id'), req.body);
  recordAudit(req, { action: 'session.updated', entity: 'AcademicSession', entityId: session._id });
  return ok(res, session, 'Academic session updated');
};

export const setCurrentSession = async (req: Request, res: Response) => {
  const session = await service.setCurrentSession(param(req, 'id'));
  recordAudit(req, { action: 'session.current', entity: 'AcademicSession', entityId: session._id, description: `Current session set to ${session.name}` });
  return ok(res, session, 'Current session updated');
};

/* Departments */
export const listDepartments = async (req: Request, res: Response) =>
  ok(res, await service.listDepartments({ search: req.query.search as string, activeOnly: req.query.activeOnly === 'true' }));

export const getDepartment = async (req: Request, res: Response) => {
  const all = await service.listDepartments({});
  const department = all.find((item) => String(item._id) === param(req, 'id'));
  if (!department) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Department not found' } });
  return ok(res, department);
};

export const createDepartment = async (req: Request, res: Response) => {
  const department = await service.createDepartment(req.body);
  recordAudit(req, { action: 'department.created', entity: 'Department', entityId: department._id, description: department.name });
  return created(res, department, 'Department created');
};

export const updateDepartment = async (req: Request, res: Response) => {
  const department = await service.updateDepartment(param(req, 'id'), req.body);
  recordAudit(req, { action: 'department.updated', entity: 'Department', entityId: department._id });
  return ok(res, department, 'Department updated');
};

export const deleteDepartment = async (req: Request, res: Response) => {
  await service.deleteDepartment(param(req, 'id'));
  recordAudit(req, { action: 'department.deleted', entity: 'Department', entityId: param(req, 'id') });
  return ok(res, { deleted: true }, 'Department deleted');
};

/* Courses */
export const listCourses = async (req: Request, res: Response) =>
  ok(res, await service.listCourses({
    search: req.query.search as string,
    department: req.query.department as string,
    activeOnly: req.query.activeOnly === 'true',
  }));

export const createCourse = async (req: Request, res: Response) => {
  const course = await service.createCourse(req.body);
  recordAudit(req, { action: 'course.created', entity: 'Course', entityId: course._id, description: course.name });
  return created(res, course, 'Course created');
};

export const updateCourse = async (req: Request, res: Response) => {
  const course = await service.updateCourse(param(req, 'id'), req.body);
  recordAudit(req, { action: 'course.updated', entity: 'Course', entityId: course._id });
  return ok(res, course, 'Course updated');
};

export const deleteCourse = async (req: Request, res: Response) => {
  await service.deleteCourse(param(req, 'id'));
  recordAudit(req, { action: 'course.deleted', entity: 'Course', entityId: param(req, 'id') });
  return ok(res, { deleted: true }, 'Course deleted');
};

/* Semesters */
export const listSemesters = async (req: Request, res: Response) =>
  ok(res, await service.listSemesters({
    course: req.query.course as string,
    session: req.query.session as string,
    department: req.query.department as string,
  }));

export const generateSemesters = async (req: Request, res: Response) => {
  const result = await service.generateSemesters(req.body);
  recordAudit(req, { action: 'semester.generated', entity: 'Semester', description: `${result.created} semesters generated` });
  return created(res, result, `${result.created} semester(s) ready`);
};

export const deleteSemester = async (req: Request, res: Response) => {
  await service.deleteSemester(param(req, 'id'));
  return ok(res, { deleted: true }, 'Semester deleted');
};

/* Sections */
export const listSections = async (req: Request, res: Response) =>
  ok(res, await service.listSections({
    semester: req.query.semester as string,
    course: req.query.course as string,
    department: req.query.department as string,
    session: req.query.session as string,
  }));

export const createSection = async (req: Request, res: Response) => {
  const section = await service.createSection(req.body);
  recordAudit(req, { action: 'section.created', entity: 'Section', entityId: section._id });
  return created(res, section, 'Section created');
};

export const updateSection = async (req: Request, res: Response) => {
  const section = await service.updateSection(param(req, 'id'), req.body);
  return ok(res, section, 'Section updated');
};

export const deleteSection = async (req: Request, res: Response) => {
  await service.deleteSection(param(req, 'id'));
  return ok(res, { deleted: true }, 'Section deleted');
};

/* Subjects */
export const listSubjects = async (req: Request, res: Response) =>
  ok(res, await service.listSubjects({
    course: req.query.course as string,
    department: req.query.department as string,
    semesterNumber: req.query.semesterNumber ? Number(req.query.semesterNumber) : undefined,
    search: req.query.search as string,
  }));

export const createSubject = async (req: Request, res: Response) => {
  const subject = await service.createSubject(req.body);
  recordAudit(req, { action: 'subject.created', entity: 'Subject', entityId: subject._id, description: subject.name });
  return created(res, subject, 'Subject created');
};

export const updateSubject = async (req: Request, res: Response) => {
  const subject = await service.updateSubject(param(req, 'id'), req.body);
  return ok(res, subject, 'Subject updated');
};

export const deleteSubject = async (req: Request, res: Response) => {
  await service.deleteSubject(param(req, 'id'));
  return ok(res, { deleted: true }, 'Subject deleted');
};

/* Teaching assignments */
export const listTeachingAssignments = async (req: Request, res: Response) =>
  ok(res, await service.listTeachingAssignments({
    teacher: req.query.teacher as string,
    section: req.query.section as string,
    subject: req.query.subject as string,
  }));

export const createTeachingAssignment = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const assignment = await service.createTeachingAssignment({ ...req.body, assignedBy: req.user.id });
  recordAudit(req, { action: 'teaching_assignment.created', entity: 'TeachingAssignment', entityId: assignment._id });
  return created(res, assignment, 'Teacher assigned');
};

export const removeTeachingAssignment = async (req: Request, res: Response) => {
  await service.removeTeachingAssignment(param(req, 'id'));
  recordAudit(req, { action: 'teaching_assignment.removed', entity: 'TeachingAssignment', entityId: param(req, 'id') });
  return ok(res, { removed: true }, 'Teaching assignment removed');
};

/* CRs */
export const listClassRepresentatives = async (_req: Request, res: Response) =>
  ok(res, await service.listClassRepresentatives());

export const assignClassRepresentative = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const student = await service.assignClassRepresentative({ ...req.body, assignedBy: req.user.id });
  recordAudit(req, { action: 'cr.assigned', entity: 'User', entityId: req.body.studentId, description: 'Class representative assigned' });
  return ok(res, student, 'Class representative assigned');
};

export const removeClassRepresentative = async (req: Request, res: Response) => {
  await service.removeClassRepresentative(param(req, 'studentId'), param(req, 'sectionId'));
  recordAudit(req, { action: 'cr.removed', entity: 'User', entityId: param(req, 'studentId') });
  return ok(res, { removed: true }, 'Class representative removed');
};
