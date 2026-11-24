import { model, Schema, type Types } from 'mongoose';
import { createSchema } from './base';
import { RESULT_POSITIONS } from '../config/constants';

const competitionSubmissionSchema = createSchema({
  competition: { type: Schema.Types.ObjectId, ref: 'Competition', required: true, index: true },
  event: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  registration: { type: Schema.Types.ObjectId, ref: 'EventRegistration', index: true },
  submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 3000 },
  fileUrl: { type: String, trim: true },
  links: [{ type: String, trim: true, maxlength: 500 }],
  answers: [
    {
      key: { type: String, required: true },
      label: { type: String, required: true },
      value: { type: Schema.Types.Mixed },
    },
  ],
  status: { type: String, enum: ['submitted', 'under_review', 'accepted', 'rejected'], default: 'submitted', index: true },
  score: { type: Number, min: 0, max: 100 },
  reviewNotes: { type: String, trim: true, maxlength: 2000 },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  submittedAt: { type: Date, default: Date.now },
});

competitionSubmissionSchema.index({ competition: 1, submittedBy: 1 }, { unique: true });

const competitionResultSchema = createSchema({
  competition: { type: Schema.Types.ObjectId, ref: 'Competition', required: true, index: true },
  event: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  position: { type: String, enum: RESULT_POSITIONS, required: true },
  participant: { type: Schema.Types.ObjectId, ref: 'User' },
  registration: { type: Schema.Types.ObjectId, ref: 'EventRegistration' },
  /** Display name allows team winners without a single participant account */
  displayName: { type: String, required: true, trim: true, maxlength: 200 },
  declaredBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  notes: { type: String, trim: true, maxlength: 500 },
  published: { type: Boolean, default: false, index: true },
});

competitionResultSchema.index({ competition: 1, position: 1 }, { unique: true });

export const CompetitionSubmission = model<CompetitionSubmissionDoc>('CompetitionSubmission', competitionSubmissionSchema);
export const CompetitionResult = model<CompetitionResultDoc>('CompetitionResult', competitionResultSchema);

export interface CompetitionSubmissionDoc {
  _id: Types.ObjectId;
  competition: Types.ObjectId;
  event: Types.ObjectId;
  registration?: Types.ObjectId;
  submittedBy: Types.ObjectId;
  title?: string;
  description?: string;
  fileUrl?: string;
  links: string[];
  answers: Array<{ key: string; label: string; value: unknown }>;
  status: string;
  score?: number;
  reviewNotes?: string;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompetitionResultDoc {
  _id: Types.ObjectId;
  competition: Types.ObjectId;
  event: Types.ObjectId;
  position: string;
  participant?: Types.ObjectId;
  registration?: Types.ObjectId;
  displayName: string;
  declaredBy: Types.ObjectId;
  notes?: string;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventAttendanceDoc {
  _id: Types.ObjectId;
  event: Types.ObjectId;
  registration?: Types.ObjectId;
  user: Types.ObjectId;
  role: 'participant' | 'volunteer' | 'teacher';
  checkInAt: Date;
  method: 'qr' | 'manual';
  checkedInBy?: Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
