import { model, Schema, type Types } from 'mongoose';
import { createSchema } from './base';
import { FORM_FIELD_TYPES } from '../config/constants';

const formFieldSchema = new Schema(
  {
    key: { type: String, required: true, trim: true, maxlength: 40 },
    label: { type: String, required: true, trim: true, maxlength: 160 },
    type: { type: String, enum: FORM_FIELD_TYPES, required: true },
    required: { type: Boolean, default: false },
    placeholder: { type: String, trim: true, maxlength: 160 },
    helpText: { type: String, trim: true, maxlength: 300 },
    options: [{ type: String, trim: true, maxlength: 160 }],
    min: { type: Number },
    max: { type: Number },
    maxLength: { type: Number, min: 1, max: 5000 },
    /** Raw HTML-free description for checkbox consent style fields */
    acceptLabel: { type: String, trim: true, maxlength: 300 },
  },
  { _id: false },
);

/**
 * Configurable, per-event registration form definition. Rendering and
 * validation are driven entirely by this document — no hardcoded forms.
 */
const dynamicFormSchema = createSchema({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, trim: true, maxlength: 1000 },
  event: { type: Schema.Types.ObjectId, ref: 'Event', index: true },
  competition: { type: Schema.Types.ObjectId, ref: 'Competition', index: true },
  fields: { type: [formFieldSchema], default: [] },
  /** null = individual, otherwise the number of members per team (incl. leader) */
  teamSize: { type: Number, min: 1, max: 20, default: null },
  allowTeamRegistration: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
});

export interface DynamicFormDoc {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  event?: Types.ObjectId;
  competition?: Types.ObjectId;
  fields: Array<{
    key: string;
    label: string;
    type: string;
    required: boolean;
    placeholder?: string;
    helpText?: string;
    options?: string[];
    min?: number;
    max?: number;
    maxLength?: number;
    acceptLabel?: string;
  }>;
  teamSize?: number | null;
  allowTeamRegistration: boolean;
  isActive: boolean;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
export const DynamicForm = model<DynamicFormDoc>('DynamicForm', dynamicFormSchema);
