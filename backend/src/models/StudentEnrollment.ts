import { model, Schema, type Types } from 'mongoose';
import { createSchema } from './base';

/**
 * Append-only academic history. Every placement change (admission, promotion,
 * section change, session roll-over) adds a new record; records are never
 * overwritten, which preserves historical academic data.
 */
const ENROLLMENT_EVENT_VALUES = ['admission', 'promotion', 'section_change', 're_enrollment', 'correction', 'graduation'] as const;
export type EnrollmentEvent = (typeof ENROLLMENT_EVENT_VALUES)[number];
export const ENROLLMENT_EVENT: string[] = [...ENROLLMENT_EVENT_VALUES];

const studentEnrollmentSchema = createSchema({
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  academicSession: { type: Schema.Types.ObjectId, ref: 'AcademicSession', required: true, index: true },
  department: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
  course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  semester: { type: Schema.Types.ObjectId, ref: 'Semester', required: true },
  semesterNumber: { type: Number, required: true },
  section: { type: Schema.Types.ObjectId, ref: 'Section', required: true },
  event: { type: String, enum: ENROLLMENT_EVENT, required: true },
  status: { type: String, enum: ['active', 'completed', 'detained', 'withdrawn'], default: 'active' },
  effectiveFrom: { type: Date, default: Date.now },
  effectiveTo: { type: Date },
  remarks: { type: String, trim: true, maxlength: 500 },
  recordedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  promotionBatch: { type: Schema.Types.ObjectId, ref: 'PromotionBatch' },
});

studentEnrollmentSchema.index({ student: 1, effectiveFrom: -1 });
studentEnrollmentSchema.index({ academicSession: 1, course: 1, semesterNumber: 1 });

export interface StudentEnrollmentDoc {
  _id: Types.ObjectId;
  student: Types.ObjectId;
  academicSession: Types.ObjectId;
  department: Types.ObjectId;
  course: Types.ObjectId;
  semester: Types.ObjectId;
  semesterNumber: number;
  section: Types.ObjectId;
  event: string;
  status: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
  remarks?: string;
  recordedBy?: Types.ObjectId;
  promotionBatch?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
export const StudentEnrollment = model<StudentEnrollmentDoc>('StudentEnrollment', studentEnrollmentSchema);
