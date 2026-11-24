import { model, Schema, type Types } from 'mongoose';
import { createSchema } from './base';
import { PAYMENT_STATUS, REGISTRATION_STATUS } from '../config/constants';

const teamMemberSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    enrollmentNumber: { type: String, trim: true, maxlength: 30 },
    email: { type: String, trim: true, lowercase: true, maxlength: 160 },
    phone: { type: String, trim: true, maxlength: 20 },
    isLeader: { type: Boolean, default: false },
    student: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false },
);

const registrationAnswerSchema = new Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    value: { type: Schema.Types.Mixed },
  },
  { _id: false },
);

const eventRegistrationSchema = createSchema({
  registrationId: { type: String, required: true, unique: true, index: true },
  event: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  competition: { type: Schema.Types.ObjectId, ref: 'Competition', index: true },
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  teamName: { type: String, trim: true, maxlength: 120 },
  isTeam: { type: Boolean, default: false },
  teamMembers: { type: [teamMemberSchema], default: [] },
  answers: { type: [registrationAnswerSchema], default: [] },
  files: [{ url: { type: String, required: true }, label: { type: String, required: true } }],
  status: { type: String, enum: REGISTRATION_STATUS, default: 'pending', required: true, index: true },
  paymentStatus: { type: String, enum: PAYMENT_STATUS, default: 'pending', required: true },
  feeAmount: { type: Number, min: 0, default: 0 },
  /** QR token used for event check-in */
  checkInCode: { type: String, required: true, unique: true },
  checkedInAt: { type: Date },
  checkedInBy: { type: Schema.Types.ObjectId, ref: 'User' },
  submittedAt: { type: Date, default: Date.now },
  notes: { type: String, trim: true, maxlength: 1000 },
});

eventRegistrationSchema.index({ event: 1, status: 1 });
eventRegistrationSchema.index({ student: 1, event: 1 }, { unique: true });
eventRegistrationSchema.index({ competition: 1, status: 1 });

export interface EventRegistrationDoc {
  _id: Types.ObjectId;
  registrationId: string;
  event: Types.ObjectId;
  competition?: Types.ObjectId;
  student: Types.ObjectId;
  teamName?: string;
  isTeam: boolean;
  teamMembers: Array<{
    name: string;
    enrollmentNumber?: string;
    email?: string;
    phone?: string;
    isLeader?: boolean;
    student?: Types.ObjectId;
  }>;
  answers: Array<{ key: string; label: string; value: unknown }>;
  files: Array<{ url: string; label: string }>;
  status: string;
  paymentStatus: string;
  feeAmount: number;
  checkInCode: string;
  checkedInAt?: Date;
  checkedInBy?: Types.ObjectId;
  submittedAt: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
export const EventRegistration = model<EventRegistrationDoc>('EventRegistration', eventRegistrationSchema);
