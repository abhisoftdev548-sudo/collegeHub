import { model, Schema, type Types } from 'mongoose';
import { createSchema } from './base';
export type { EventAttendanceDoc } from './CompetitionSubmission';
import { ATTENDANCE_STATUS } from '../config/constants';

/** Academic attendance: one record per student per subject per class date. */
const attendanceRecordSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ATTENDANCE_STATUS, required: true },
    remarks: { type: String, trim: true, maxlength: 200 },
    markedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const attendanceSchema = createSchema({
  subject: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
  section: { type: Schema.Types.ObjectId, ref: 'Section', required: true, index: true },
  semester: { type: Schema.Types.ObjectId, ref: 'Semester', required: true, index: true },
  course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
  department: { type: Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
  academicSession: { type: Schema.Types.ObjectId, ref: 'AcademicSession', required: true, index: true },
  teacher: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: Date, required: true, index: true },
  /** Normalised day key (YYYY-MM-DD) to enforce one sheet per class per day */
  dateKey: { type: String, required: true, index: true },
  records: { type: [attendanceRecordSchema], default: [] },
  markedByName: { type: String, trim: true, maxlength: 120 },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
});

attendanceSchema.index({ subject: 1, section: 1, dateKey: 1 }, { unique: true });
attendanceSchema.index({ student: 1 });

/** Event attendance: independent from academic attendance. */
const eventAttendanceSchema = createSchema({
  event: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  registration: { type: Schema.Types.ObjectId, ref: 'EventRegistration', index: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  role: { type: String, enum: ['participant', 'volunteer', 'teacher'], required: true, index: true },
  checkInAt: { type: Date, required: true },
  method: { type: String, enum: ['qr', 'manual'], default: 'manual' },
  checkedInBy: { type: Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String, trim: true, maxlength: 300 },
});

eventAttendanceSchema.index({ event: 1, user: 1, role: 1 }, { unique: true });
eventAttendanceSchema.index({ event: 1, checkInAt: -1 });

export interface AttendanceDoc {
  _id: Types.ObjectId;
  subject: Types.ObjectId;
  section: Types.ObjectId;
  semester: Types.ObjectId;
  course: Types.ObjectId;
  department: Types.ObjectId;
  academicSession: Types.ObjectId;
  teacher: Types.ObjectId;
  date: Date;
  dateKey: string;
  records: Array<{ student: Types.ObjectId; status: string; remarks?: string; markedAt?: Date }>;
  markedByName?: string;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
export const Attendance = model<AttendanceDoc>('Attendance', attendanceSchema);
export const EventAttendance = model<import('./CompetitionSubmission').EventAttendanceDoc>('EventAttendance', eventAttendanceSchema);
