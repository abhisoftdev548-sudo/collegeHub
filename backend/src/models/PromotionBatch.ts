import { model, Schema, type Types } from 'mongoose';
import { createSchema } from './base';

/**
 * An authorised semester-promotion run. Records exactly which students moved
 * from which semester/session to which, so the operation is auditable and
 * reversible via corrective records.
 */
const promotionItemSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    fromSemester: { type: Schema.Types.ObjectId, ref: 'Semester', required: true },
    toSemester: { type: Schema.Types.ObjectId, ref: 'Semester' },
    fromSection: { type: Schema.Types.ObjectId, ref: 'Section' },
    toSection: { type: Schema.Types.ObjectId, ref: 'Section' },
    outcome: {
      type: String,
      enum: ['promoted', 'detained', 'graduated', 'skipped', 'excluded'],
      required: true,
    },
    reason: { type: String, trim: true, maxlength: 300 },
  },
  { _id: false },
);

const promotionBatchSchema = createSchema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  fromSession: { type: Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
  toSession: { type: Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
  status: {
    type: String,
    enum: ['preview', 'approved', 'cancelled'],
    default: 'preview',
    required: true,
    index: true,
  },
  scope: {
    department: { type: Schema.Types.ObjectId, ref: 'Department' },
    course: { type: Schema.Types.ObjectId, ref: 'Course' },
    semesterNumber: { type: Number },
  },
  items: { type: [promotionItemSchema], default: [] },
  summary: {
    total: { type: Number, default: 0 },
    promoted: { type: Number, default: 0 },
    detained: { type: Number, default: 0 },
    graduated: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    excluded: { type: Number, default: 0 },
  },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
});

promotionBatchSchema.index({ createdAt: -1 });

export interface PromotionBatchDoc {
  _id: Types.ObjectId;
  name: string;
  fromSession: Types.ObjectId;
  toSession: Types.ObjectId;
  status: 'preview' | 'approved' | 'cancelled';
  scope: { department?: Types.ObjectId; course?: Types.ObjectId; semesterNumber?: number };
  items: Array<{
    student: Types.ObjectId;
    fromSemester: Types.ObjectId;
    toSemester?: Types.ObjectId;
    fromSection?: Types.ObjectId;
    toSection?: Types.ObjectId;
    outcome: 'promoted' | 'detained' | 'graduated' | 'skipped' | 'excluded';
    reason?: string;
  }>;
  summary: { total: number; promoted: number; detained: number; graduated: number; skipped: number; excluded: number };
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
export const PromotionBatch = model<PromotionBatchDoc>('PromotionBatch', promotionBatchSchema);
