import { model, Schema, type Types } from 'mongoose';
import { createSchema } from './base';
import { TASK_PRIORITY, TASK_STATUS } from '../config/constants';

const taskSchema = createSchema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 2000 },
  event: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  group: { type: Schema.Types.ObjectId, ref: 'VolunteerGroup', index: true },
  assignedTo: [{ type: Schema.Types.ObjectId, ref: 'User', index: true }],
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: TASK_STATUS, default: 'pending', required: true, index: true },
  priority: { type: String, enum: TASK_PRIORITY, default: 'medium', required: true },
  dueDate: { type: Date, index: true },
  completedAt: { type: Date },
  completedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  /** Simple progress/activity trail for transparency */
  updates: [
    {
      by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      status: { type: String, enum: TASK_STATUS, required: true },
      note: { type: String, trim: true, maxlength: 500 },
      at: { type: Date, default: Date.now },
    },
  ],
});

taskSchema.index({ event: 1, status: 1 });
taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ dueDate: 1, status: 1 });

export interface TaskDoc {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  event: Types.ObjectId;
  group?: Types.ObjectId;
  assignedTo: Types.ObjectId[];
  createdBy: Types.ObjectId;
  status: string;
  priority: string;
  dueDate?: Date;
  completedAt?: Date;
  completedBy?: Types.ObjectId;
  updates: Array<{ by: Types.ObjectId; status: string; note?: string; at: Date }>;
  createdAt: Date;
  updatedAt: Date;
}
export const Task = model<TaskDoc>('Task', taskSchema);
