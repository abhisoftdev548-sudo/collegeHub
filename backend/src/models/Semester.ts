import { model, Schema, type Types } from 'mongoose';
import { createSchema } from './base';

/**
 * A semester is a concrete, session-scoped offering of a course semester.
 * e.g. B.Tech CSE — Semester 3 — Session 2025-26 (Section A, Section B).
 * Sections and student enrollments reference this document, which makes
 * semester promotion an explicit, auditable operation.
 */
const semesterSchema = createSchema({
  course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
  number: { type: Number, required: true, min: 1, max: 12 },
  academicSession: { type: Schema.Types.ObjectId, ref: 'AcademicSession', required: true, index: true },
  label: { type: String, required: true, trim: true, maxlength: 80 },
  isActive: { type: Boolean, default: true },
});

semesterSchema.index({ course: 1, academicSession: 1, number: 1 }, { unique: true });

export interface SemesterDoc {
  _id: Types.ObjectId;
  course: Types.ObjectId;
  number: number;
  academicSession: Types.ObjectId;
  label: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export const Semester = model<SemesterDoc>('Semester', semesterSchema);
