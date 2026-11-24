import { model, Schema, type Types } from 'mongoose';
import { createSchema } from './base';

const sectionSchema = createSchema({
  name: { type: String, required: true, trim: true, maxlength: 40 }, // A, B, C
  semester: { type: Schema.Types.ObjectId, ref: 'Semester', required: true, index: true },
  course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
  department: { type: Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
  academicSession: { type: Schema.Types.ObjectId, ref: 'AcademicSession', required: true, index: true },
  /** Read-only mirror of User.responsibilities[cr] for fast section queries. */
  crStudents: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  capacity: { type: Number, default: 60, min: 1 },
  isActive: { type: Boolean, default: true },
});

sectionSchema.index({ semester: 1, name: 1 }, { unique: true });
sectionSchema.index({ department: 1, academicSession: 1 });

export interface SectionDoc {
  _id: Types.ObjectId;
  name: string;
  semester: Types.ObjectId;
  course: Types.ObjectId;
  department: Types.ObjectId;
  academicSession: Types.ObjectId;
  crStudents: Types.ObjectId[];
  capacity: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export const Section = model<SectionDoc>('Section', sectionSchema);
