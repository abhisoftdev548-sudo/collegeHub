import { model, Schema, type Types } from 'mongoose';
import { createSchema } from './base';

const subjectSchema = createSchema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  code: { type: String, required: true, uppercase: true, trim: true, maxlength: 24 },
  department: { type: Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
  course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
  semesterNumber: { type: Number, required: true, min: 1, max: 12 },
  credits: { type: Number, min: 0, max: 20 },
  /** Default teacher(s) for the subject; per-section overrides live in TeachingAssignment. */
  teachers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  description: { type: String, trim: true, maxlength: 1000 },
  isActive: { type: Boolean, default: true },
});

subjectSchema.index({ code: 1, course: 1 }, { unique: true });
subjectSchema.index({ course: 1, semesterNumber: 1 });

export interface SubjectDoc {
  _id: Types.ObjectId;
  name: string;
  code: string;
  department: Types.ObjectId;
  course: Types.ObjectId;
  semesterNumber: number;
  credits?: number;
  teachers: Types.ObjectId[];
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export const Subject = model<SubjectDoc>('Subject', subjectSchema);
