import { model, Schema, type Types } from 'mongoose';
import { createSchema } from './base';

const courseSchema = createSchema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 16 },
  department: { type: Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
  description: { type: String, trim: true, maxlength: 2000 },
  durationYears: { type: Number, required: true, min: 1, max: 6 },
  totalSemesters: { type: Number, required: true, min: 1, max: 12 },
  degreeLevel: { type: String, enum: ['undergraduate', 'postgraduate', 'diploma', 'certificate'], default: 'undergraduate' },
  isActive: { type: Boolean, default: true },
});

courseSchema.index({ department: 1, name: 1 });

export interface CourseDoc {
  _id: Types.ObjectId;
  name: string;
  code: string;
  department: Types.ObjectId;
  description?: string;
  durationYears: number;
  totalSemesters: number;
  degreeLevel: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export const Course = model<CourseDoc>('Course', courseSchema);
