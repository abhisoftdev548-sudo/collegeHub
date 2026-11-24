import { model, Schema, type Types } from 'mongoose';
import { createSchema } from './base';

const competitionSchema = createSchema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 5000 },
  event: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  category: { type: String, trim: true, maxlength: 80 },
  rules: { type: String, trim: true, maxlength: 5000 },
  eligibility: { type: String, trim: true, maxlength: 2000 },
  maxParticipants: { type: Number, min: 0 },
  teamSize: { type: Number, min: 1, max: 20, default: 1 },
  allowTeamRegistration: { type: Boolean, default: false },
  registrationDeadline: { type: Date },
  fee: { type: Number, min: 0, default: 0 },
  feeType: { type: String, enum: ['individual', 'team'], default: 'individual' },
  form: { type: Schema.Types.ObjectId, ref: 'DynamicForm' },
  judges: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  coordinators: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  submissionRequired: { type: Boolean, default: false },
  submissionDeadline: { type: Date },
  resultsPublished: { type: Boolean, default: false },
  status: { type: String, enum: ['draft', 'open', 'closed', 'judging', 'published'], default: 'draft', index: true },
  startDateTime: { type: Date },
  venue: { type: String, trim: true, maxlength: 200 },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
});

competitionSchema.index({ event: 1, status: 1 });
competitionSchema.index({ judges: 1 });

export interface CompetitionDoc {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  event: Types.ObjectId;
  category?: string;
  rules?: string;
  eligibility?: string;
  maxParticipants?: number;
  teamSize: number;
  allowTeamRegistration: boolean;
  registrationDeadline?: Date;
  fee: number;
  feeType: string;
  form?: Types.ObjectId;
  judges: Types.ObjectId[];
  coordinators: Types.ObjectId[];
  submissionRequired: boolean;
  submissionDeadline?: Date;
  resultsPublished: boolean;
  status: string;
  startDateTime?: Date;
  venue?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
export const Competition = model<CompetitionDoc>('Competition', competitionSchema);
