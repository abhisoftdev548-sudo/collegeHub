import { z } from 'zod';
import { objectId, paginationQuery } from './common';

export const studentCreateSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().email(),
    phone: z.string().trim().max(20).optional(),
    enrollmentNumber: z.string().trim().min(3).max(30),
    rollNumber: z.string().trim().max(30).optional(),
    department: objectId(),
    course: objectId(),
    semester: objectId(),
    section: objectId(),
    academicSession: objectId(),
    admissionYear: z.coerce.number().int().min(1990).max(2100),
    guardianName: z.string().trim().max(120).optional(),
    guardianPhone: z.string().trim().max(20).optional(),
    gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
    dateOfBirth: z.string().optional(),
    address: z.string().trim().max(500).optional(),
    bloodGroup: z.string().trim().max(8).optional(),
    password: z.string().min(8).max(120).optional(),
  })
  .strict();

export const studentUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    email: z.string().trim().toLowerCase().email().optional(),
    phone: z.string().trim().max(20).optional(),
    rollNumber: z.string().trim().max(30).optional(),
    section: objectId().optional(),
    status: z.enum(['active', 'inactive', 'graduated', 'detained', 'dropped']).optional(),
    guardianName: z.string().trim().max(120).optional(),
    guardianPhone: z.string().trim().max(20).optional(),
    gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
    dateOfBirth: z.string().optional(),
    address: z.string().trim().max(500).optional(),
    bloodGroup: z.string().trim().max(8).optional(),
    promotionHold: z.boolean().optional(),
  })
  .strict();

export const studentListSchema = paginationQuery.extend({
  department: objectId().optional(),
  course: objectId().optional(),
  semester: objectId().optional(),
  section: objectId().optional(),
  session: objectId().optional(),
  status: z.string().trim().max(20).optional(),
  isCR: z.coerce.boolean().optional(),
});

export const teacherCreateSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().email(),
    phone: z.string().trim().max(20).optional(),
    designation: z.string().trim().max(120).optional(),
    departmentId: objectId().optional(),
    extraPermissions: z.array(z.string().trim().max(60)).max(40).optional(),
  })
  .strict();

export const teacherUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    email: z.string().trim().toLowerCase().email().optional(),
    phone: z.string().trim().max(20).optional(),
    designation: z.string().trim().max(120).optional(),
    status: z.enum(['active', 'suspended', 'inactive']).optional(),
    role: z.enum(['teacher', 'admin']).optional(),
    extraPermissions: z.array(z.string().trim().max(60)).max(40).optional(),
  })
  .strict();

export const teacherListSchema = paginationQuery.extend({
  department: objectId().optional(),
  status: z.string().trim().max(20).optional(),
});

export const promotionPreviewSchema = z
  .object({
    fromSession: objectId(),
    toSession: objectId(),
    department: objectId().optional(),
    course: objectId().optional(),
    semesterNumber: z.coerce.number().int().min(1).max(12).optional(),
    detainStudentIds: z.array(objectId()).max(500).optional(),
    overrides: z
      .array(
        z.object({
          studentId: objectId(),
          toSemesterNumber: z.coerce.number().int().min(1).max(12),
          reason: z.string().trim().max(300).optional(),
        }),
      )
      .max(500)
      .optional(),
  })
  .strict();

export const promotionCreateSchema = promotionPreviewSchema.extend({
  name: z.string().trim().min(3).max(160).optional(),
}).strict();

export const placementCorrectionSchema = z
  .object({
    semester: objectId(),
    section: objectId(),
    remarks: z.string().trim().min(3).max(500),
  })
  .strict();
