import { model, Schema, type Types } from 'mongoose';
import { createSchema } from './base';

const STUDENT_STATUS_VALUES = ['active', 'inactive', 'graduated', 'detained', 'dropped'] as const;
export type StudentStatus = (typeof STUDENT_STATUS_VALUES)[number];
export const STUDENT_STATUS: string[] = [...STUDENT_STATUS_VALUES];

/**
 * Academic identity of a student. One-to-one with a User account.
 * Current placement is denormalised here for fast dashboard queries while the
 * authoritative, append-only history lives in StudentEnrollment.
 */
const studentProfileSchema = createSchema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  enrollmentNumber: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 30 },
  rollNumber: { type: String, trim: true, maxlength: 30 },
  department: { type: Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
  course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
  academicSession: { type: Schema.Types.ObjectId, ref: 'AcademicSession', required: true, index: true },
  semester: { type: Schema.Types.ObjectId, ref: 'Semester', required: true, index: true },
  section: { type: Schema.Types.ObjectId, ref: 'Section', required: true, index: true },
  admissionYear: { type: Number, required: true, min: 1990, max: 2100 },
  status: { type: String, enum: STUDENT_STATUS, default: 'active', required: true, index: true },
  guardianName: { type: String, trim: true, maxlength: 120 },
  guardianPhone: { type: String, trim: true, maxlength: 20 },
  dateOfBirth: { type: Date },
  gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
  address: { type: String, trim: true, maxlength: 500 },
  bloodGroup: { type: String, trim: true, maxlength: 8 },
  /** Set when a student is excluded from an in-progress promotion batch. */
  promotionHold: { type: Boolean, default: false },
});

studentProfileSchema.index({ section: 1, status: 1 });
studentProfileSchema.index({ course: 1, academicSession: 1, semester: 1 });
studentProfileSchema.index({ name: 1 });

export interface StudentProfileDoc {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  enrollmentNumber: string;
  rollNumber?: string;
  department: Types.ObjectId;
  course: Types.ObjectId;
  academicSession: Types.ObjectId;
  semester: Types.ObjectId;
  section: Types.ObjectId;
  admissionYear: number;
  status: string;
  guardianName?: string;
  guardianPhone?: string;
  dateOfBirth?: Date;
  gender?: string;
  address?: string;
  bloodGroup?: string;
  promotionHold: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export const StudentProfile = model<StudentProfileDoc>('StudentProfile', studentProfileSchema);
