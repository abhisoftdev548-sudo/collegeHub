import { model, Schema, type Types } from 'mongoose';
import { createSchema } from './base';

const NOTIFICATION_TYPES_VALUES = [
  'event_new',
  'registration_deadline',
  'event_update',
  'attendance_update',
  'task_assigned',
  'task_deadline',
  'academic',
  'promotion',
  'result_published',
  'announcement',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES_VALUES)[number];
export const NOTIFICATION_TYPES: string[] = [...NOTIFICATION_TYPES_VALUES];

const notificationSchema = createSchema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: NOTIFICATION_TYPES, required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  message: { type: String, trim: true, maxlength: 1000 },
  link: { type: String, trim: true, maxlength: 300 },
  read: { type: Boolean, default: false, index: true },
  readAt: { type: Date },
  meta: { type: Schema.Types.Mixed },
});

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

export interface NotificationDoc {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  type: string;
  title: string;
  message?: string;
  link?: string;
  read: boolean;
  readAt?: Date;
  meta?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
export const Notification = model<NotificationDoc>('Notification', notificationSchema);
