import { z } from 'zod';
import { objectId, paginationQuery } from './common';
import {
  SESSION_STATUS,
} from '../config/constants';

const nonEmptyString = (max = 200) => z.string().trim().min(1).max(max);
const optionalId = z.union([objectId(), z.literal('')]).optional();
const objectIdArray = z.array(objectId()).max(200).optional();

export const sessionCreateSchema = z
  .object({
    name: z.string().trim().min(4).max(40),
    startDate: z.string(),
    endDate: z.string(),
    status: z.enum(SESSION_STATUS as [string, ...string[]]).optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .strict();

export const sessionUpdateSchema = z
  .object({
    name: z.string().trim().min(4).max(40).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    status: z.enum(SESSION_STATUS as [string, ...string[]]).optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .strict();

export const departmentCreateSchema = z
  .object({
    name: nonEmptyString(160),
    code: z.string().trim().min(2).max(12),
    description: z.string().trim().max(2000).optional(),
    head: z.union([objectId(), z.literal('')]).optional(),
    teachers: objectIdArray,
  })
  .strict();

export const departmentUpdateSchema = departmentCreateSchema.partial().strict();

export const courseCreateSchema = z
  .object({
    name: nonEmptyString(160),
    code: z.string().trim().min(2).max(16),
    department: objectId(),
    description: z.string().trim().max(2000).optional(),
    durationYears: z.coerce.number().int().min(1).max(6),
    totalSemesters: z.coerce.number().int().min(1).max(12),
    degreeLevel: z.enum(['undergraduate', 'postgraduate', 'diploma', 'certificate']).optional(),
  })
  .strict();

export const courseUpdateSchema = courseCreateSchema.partial().extend({ isActive: z.boolean().optional() }).strict();

export const semesterGenerateSchema = z
  .object({ course: objectId(), academicSession: objectId() })
  .strict();

export const sectionCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    semester: objectId(),
    capacity: z.coerce.number().int().min(1).max(500).optional(),
  })
  .strict();

export const sectionUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(40).optional(),
    capacity: z.coerce.number().int().min(1).max(500).optional(),
    isActive: z.boolean().optional(),
    crStudents: objectIdArray,
  })
  .strict();

export const subjectCreateSchema = z
  .object({
    name: nonEmptyString(160),
    code: z.string().trim().min(2).max(24),
    course: objectId(),
    semesterNumber: z.coerce.number().int().min(1).max(12),
    credits: z.coerce.number().min(0).max(20).optional(),
    teachers: objectIdArray,
    description: z.string().trim().max(1000).optional(),
  })
  .strict();

export const subjectUpdateSchema = subjectCreateSchema.partial().extend({ isActive: z.boolean().optional() }).strict();

export const teachingAssignmentCreateSchema = z
  .object({ teacher: objectId(), subject: objectId(), section: objectId() })
  .strict();

export const crAssignSchema = z
  .object({ studentId: objectId(), sectionId: objectId(), isPrimary: z.boolean().optional() })
  .strict();

export const academicListQuery = paginationQuery.extend({
  department: objectId().optional(),
  course: objectId().optional(),
  session: objectId().optional(),
  semester: objectId().optional(),
  activeOnly: z.coerce.boolean().optional(),
});

export { optionalId };
