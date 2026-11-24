import { model, Schema, type Types } from 'mongoose';
import { createSchema } from './base';
import { ANNOUNCEMENT_AUDIENCES } from '../config/constants';

const announcementSchema = createSchema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  body: { type: String, required: true, trim: true, maxlength: 5000 },
  audience: { type: String, enum: ANNOUNCEMENT_AUDIENCES, required: true, index: true },
  priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
  department: { type: Schema.Types.ObjectId, ref: 'Department', index: true },
  course: { type: Schema.Types.ObjectId, ref: 'Course', index: true },
  semester: { type: Schema.Types.ObjectId, ref: 'Semester', index: true },
  section: { type: Schema.Types.ObjectId, ref: 'Section', index: true },
  event: { type: Schema.Types.ObjectId, ref: 'Event', index: true },
  volunteerGroup: { type: Schema.Types.ObjectId, ref: 'VolunteerGroup', index: true },
  published: { type: Boolean, default: true, index: true },
  /** Set once notification fan-out ran (used by the scheduled-delivery cron). */
  notifiedAt: { type: Date },
  publishAt: { type: Date, default: Date.now, index: true },
  expiresAt: { type: Date },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
});

announcementSchema.index({ published: 1, publishAt: -1 });
announcementSchema.index({ audience: 1, department: 1 });
announcementSchema.index({ title: 'text', body: 'text' });

export interface AnnouncementDoc {
  _id: Types.ObjectId;
  title: string;
  body: string;
  audience: string;
  priority: string;
  department?: Types.ObjectId;
  course?: Types.ObjectId;
  semester?: Types.ObjectId;
  section?: Types.ObjectId;
  event?: Types.ObjectId;
  volunteerGroup?: Types.ObjectId;
  published: boolean;
  publishAt: Date;
  notifiedAt?: Date;
  expiresAt?: Date;
  createdBy: Types.ObjectId;
  readBy: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}
export const Announcement = model<AnnouncementDoc>('Announcement', announcementSchema);
