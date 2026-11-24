import { model, Schema, type Types } from 'mongoose';
import { createSchema } from './base';
import { RESPONSIBILITIES, ROLES } from '../config/constants';

const USER_STATUS_VALUES = ['active', 'suspended', 'inactive'] as const;
export type UserStatus = (typeof USER_STATUS_VALUES)[number];
export const USER_STATUS: string[] = [...USER_STATUS_VALUES];

const responsibilitySchema = new Schema(
  {
    type: { type: String, enum: RESPONSIBILITIES, required: true },
    /** CR responsibility scope */
    section: { type: Schema.Types.ObjectId, ref: 'Section' },
    isPrimary: { type: Boolean, default: false },
    /** Volunteer responsibility scope */
    event: { type: Schema.Types.ObjectId, ref: 'Event' },
    group: { type: Schema.Types.ObjectId, ref: 'VolunteerGroup' },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    assignedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const userSchema = createSchema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    phone: { type: String, trim: true, maxlength: 20 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, index: true },
    status: { type: String, enum: USER_STATUS, default: 'active', required: true, index: true },
    avatarUrl: { type: String },
    designation: { type: String, trim: true, maxlength: 120 },
    mustChangePassword: { type: Boolean, default: false },
    lastLoginAt: { type: Date },
    responsibilities: { type: [responsibilitySchema], default: [] },
    /** Extra permissions granted to a teacher by an admin. Admin permissions are implicit. */
    extraPermissions: { type: [String], default: [] },
  },
);

userSchema.index({ 'responsibilities.section': 1 });
userSchema.index({ 'responsibilities.event': 1 });
userSchema.index({ role: 1, status: 1 });

export interface UserDoc {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  passwordHash: string;
  role: 'admin' | 'teacher' | 'student';
  status: 'active' | 'suspended' | 'inactive';
  avatarUrl?: string;
  designation?: string;
  mustChangePassword: boolean;
  lastLoginAt?: Date;
  responsibilities: Array<{
    _id?: Types.ObjectId;
    type: 'cr' | 'volunteer';
    section?: Types.ObjectId;
    isPrimary?: boolean;
    event?: Types.ObjectId;
    group?: Types.ObjectId;
    assignedBy?: Types.ObjectId;
    assignedAt?: Date;
  }>;
  extraPermissions: string[];
  createdAt: Date;
  updatedAt: Date;
}
export const User = model<UserDoc>('User', userSchema);
