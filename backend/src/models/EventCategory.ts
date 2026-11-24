import { model, type Types } from 'mongoose';
import { createSchema } from './base';

const eventCategorySchema = createSchema({
  name: { type: String, required: true, trim: true, maxlength: 80, unique: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  description: { type: String, trim: true, maxlength: 500 },
  color: { type: String, default: '#2f6fed', maxlength: 20 },
  isActive: { type: Boolean, default: true },
});

export interface EventCategoryDoc {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  color: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export const EventCategory = model<EventCategoryDoc>('EventCategory', eventCategorySchema);
