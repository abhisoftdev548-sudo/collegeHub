import { model, Schema, type Types } from 'mongoose';
import { createSchema } from './base';
import { SESSION_STATUS } from '../config/constants';

const academicSessionSchema = createSchema({
  name: { type: String, required: true, unique: true, trim: true, maxlength: 40 }, // e.g. "2025-26"
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { type: String, enum: SESSION_STATUS, default: 'upcoming', required: true, index: true },
  isCurrent: { type: Boolean, default: false, index: true },
  notes: { type: String, trim: true, maxlength: 1000 },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
});

academicSessionSchema.index({ startDate: -1 });

export interface AcademicSessionDoc {
  _id: Types.ObjectId;
  name: string;
  startDate: Date;
  endDate: Date;
  status: string;
  isCurrent: boolean;
  notes?: string;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
export const AcademicSession = model<AcademicSessionDoc>('AcademicSession', academicSessionSchema);
