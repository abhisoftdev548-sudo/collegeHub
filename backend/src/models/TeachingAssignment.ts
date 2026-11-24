import { model, Schema, type Types } from 'mongoose';
import { createSchema } from './base';

/**
 * A teacher's concrete teaching duty for a session:
 * teacher + subject + section (+ semester/course/department denormalised for
 * fast authorisation scoping).
 */
const teachingAssignmentSchema = createSchema({
  teacher: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  subject: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
  section: { type: Schema.Types.ObjectId, ref: 'Section', required: true, index: true },
  semester: { type: Schema.Types.ObjectId, ref: 'Semester', required: true, index: true },
  course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
  department: { type: Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
  academicSession: { type: Schema.Types.ObjectId, ref: 'AcademicSession', required: true, index: true },
  isActive: { type: Boolean, default: true },
  assignedBy: { type: Schema.Types.ObjectId, ref: 'User' },
});

teachingAssignmentSchema.index(
  { teacher: 1, subject: 1, section: 1, academicSession: 1 },
  { unique: true },
);
teachingAssignmentSchema.index({ teacher: 1, isActive: 1 });
teachingAssignmentSchema.index({ section: 1, subject: 1 });

export interface TeachingAssignmentDoc {
  _id: Types.ObjectId;
  teacher: Types.ObjectId;
  subject: Types.ObjectId;
  section: Types.ObjectId;
  semester: Types.ObjectId;
  course: Types.ObjectId;
  department: Types.ObjectId;
  academicSession: Types.ObjectId;
  isActive: boolean;
  assignedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
export const TeachingAssignment = model<TeachingAssignmentDoc>('TeachingAssignment', teachingAssignmentSchema);
