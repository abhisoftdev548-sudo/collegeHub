import { model, Schema, type Types } from 'mongoose';
import { createSchema } from './base';

/**
 * Standalone form submissions (used when a form is not tied to event
 * registration, e.g. feedback or additional information requests).
 */
const formSubmissionSchema = createSchema({
  form: { type: Schema.Types.ObjectId, ref: 'DynamicForm', required: true, index: true },
  event: { type: Schema.Types.ObjectId, ref: 'Event', index: true },
  competition: { type: Schema.Types.ObjectId, ref: 'Competition', index: true },
  submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  answers: [
    {
      key: { type: String, required: true },
      label: { type: String, required: true },
      value: { type: Schema.Types.Mixed },
    },
  ],
  files: [{ url: { type: String, required: true }, label: { type: String, required: true } }],
  status: { type: String, enum: ['submitted', 'reviewed', 'rejected'], default: 'submitted' },
  reviewNotes: { type: String, trim: true, maxlength: 1000 },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
});

formSubmissionSchema.index({ event: 1, submittedBy: 1 });

export interface FormSubmissionDoc {
  _id: Types.ObjectId;
  form: Types.ObjectId;
  event?: Types.ObjectId;
  competition?: Types.ObjectId;
  submittedBy: Types.ObjectId;
  answers: Array<{ key: string; label: string; value: unknown }>;
  files: Array<{ url: string; label: string }>;
  status: string;
  reviewNotes?: string;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
export const FormSubmission = model<FormSubmissionDoc>('FormSubmission', formSubmissionSchema);
