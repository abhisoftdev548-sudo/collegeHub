import { model, Schema, type Types } from 'mongoose';
import { createSchema } from './base';

const volunteerGroupSchema = createSchema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  event: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  description: { type: String, trim: true, maxlength: 1000 },
  /** Teacher/coordinator in charge of the group */
  coordinator: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  leader: { type: Schema.Types.ObjectId, ref: 'User' },
  members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  isActive: { type: Boolean, default: true },
});

volunteerGroupSchema.index({ event: 1, name: 1 });
volunteerGroupSchema.index({ members: 1 });
volunteerGroupSchema.index({ leader: 1 });

export interface VolunteerGroupDoc {
  _id: Types.ObjectId;
  name: string;
  event: Types.ObjectId;
  description?: string;
  coordinator: Types.ObjectId;
  leader?: Types.ObjectId;
  members: Types.ObjectId[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export const VolunteerGroup = model<VolunteerGroupDoc>('VolunteerGroup', volunteerGroupSchema);
