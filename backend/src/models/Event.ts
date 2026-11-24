import { model, Schema, type Types } from 'mongoose';
import { createSchema } from './base';
import { EVENT_STATUS } from '../config/constants';

const eventSchema = createSchema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  description: { type: String, trim: true, maxlength: 5000 },
  bannerUrl: { type: String, trim: true },
  category: { type: Schema.Types.ObjectId, ref: 'EventCategory', required: true, index: true },
  /** null for college-wide events */
  department: { type: Schema.Types.ObjectId, ref: 'Department', index: true },
  /** A main event (fest) can contain sub-events */
  parentEvent: { type: Schema.Types.ObjectId, ref: 'Event', default: null, index: true },
  isMainEvent: { type: Boolean, default: false },
  coordinator: { type: Schema.Types.ObjectId, ref: 'User' },
  teachers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  startDate: { type: Date, required: true, index: true },
  endDate: { type: Date, required: true },
  registrationStartDate: { type: Date },
  registrationDeadline: { type: Date },
  venue: { type: String, trim: true, maxlength: 200 },
  status: { type: String, enum: EVENT_STATUS, default: 'draft', required: true, index: true },
  participationRules: { type: String, trim: true, maxlength: 3000 },
  requirements: { type: String, trim: true, maxlength: 3000 },
  budget: {
    estimated: { type: Number, min: 0 },
    spent: { type: Number, min: 0, default: 0 },
    notes: { type: String, trim: true, maxlength: 1000 },
  },
  registration: {
    isEnabled: { type: Boolean, default: false },
    requiresApproval: { type: Boolean, default: false },
    maxParticipants: { type: Number, min: 0 },
    fee: { type: Number, min: 0, default: 0 },
    feeType: { type: String, enum: ['individual', 'team'], default: 'individual' },
    /** DynamicForm used for registration */
    form: { type: Schema.Types.ObjectId, ref: 'DynamicForm' },
  },
  isPublic: { type: Boolean, default: true },
  publishedAt: { type: Date },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  /** Used to keep faculty scoping correct when checking event permissions. */
  involvesAllDepartments: { type: Boolean, default: false },
});

eventSchema.index({ status: 1, startDate: 1 });
eventSchema.index({ department: 1, status: 1 });
eventSchema.index({ teachers: 1 });
eventSchema.index({ title: 'text', description: 'text' });

export interface EventDoc {
  _id: Types.ObjectId;
  title: string;
  slug: string;
  description?: string;
  bannerUrl?: string;
  category: Types.ObjectId;
  department?: Types.ObjectId;
  parentEvent?: Types.ObjectId | null;
  isMainEvent: boolean;
  coordinator?: Types.ObjectId;
  teachers: Types.ObjectId[];
  startDate: Date;
  endDate: Date;
  registrationStartDate?: Date;
  registrationDeadline?: Date;
  venue?: string;
  status: string;
  participationRules?: string;
  requirements?: string;
  budget?: { estimated?: number; spent?: number; notes?: string };
  registration: {
    isEnabled: boolean;
    requiresApproval: boolean;
    maxParticipants?: number;
    fee: number;
    feeType: string;
    form?: Types.ObjectId;
  };
  isPublic: boolean;
  publishedAt?: Date;
  createdBy: Types.ObjectId;
  involvesAllDepartments: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export const Event = model<EventDoc>('Event', eventSchema);
