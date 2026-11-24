import { model, Schema, type Types } from 'mongoose';
import { createSchema } from './base';

const departmentSchema = createSchema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 12 },
  description: { type: String, trim: true, maxlength: 2000 },
  head: { type: Schema.Types.ObjectId, ref: 'User' },
  teachers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  isActive: { type: Boolean, default: true },
});

departmentSchema.index({ name: 1 });

export interface DepartmentDoc {
  _id: Types.ObjectId;
  name: string;
  code: string;
  description?: string;
  head?: Types.ObjectId;
  teachers: Types.ObjectId[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export const Department = model<DepartmentDoc>('Department', departmentSchema);
