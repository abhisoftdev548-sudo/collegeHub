import { model, type Types } from 'mongoose';
import { createSchema } from './base';

/**
 * Singleton platform settings document (key = 'platform').
 */
const settingsSchema = createSchema({
  key: { type: String, required: true, unique: true, default: 'platform' },
  collegeName: { type: String, trim: true, maxlength: 200 },
  collegeEmail: { type: String, trim: true, maxlength: 160 },
  collegePhone: { type: String, trim: true, maxlength: 30 },
  address: { type: String, trim: true, maxlength: 500 },
  allowSelfRegistration: { type: Boolean, default: false },
  maintenanceMode: { type: Boolean, default: false },
  announcementBanner: { type: String, trim: true, maxlength: 300 },
  socialLinks: {
    website: { type: String, trim: true, maxlength: 200 },
    instagram: { type: String, trim: true, maxlength: 200 },
    youtube: { type: String, trim: true, maxlength: 200 },
  },
  paymentConfig: {
    gatewayEnabled: { type: Boolean, default: false },
    /** Only the *public* key id is exposed to clients; secrets stay in env. */
    razorpayKeyId: { type: String, trim: true, maxlength: 120 },
    paymentInstructions: { type: String, trim: true, maxlength: 2000 },
  },
});

export interface SettingsDoc {
  _id: Types.ObjectId;
  key: string;
  collegeName?: string;
  collegeEmail?: string;
  collegePhone?: string;
  address?: string;
  allowSelfRegistration: boolean;
  maintenanceMode: boolean;
  announcementBanner?: string;
  socialLinks?: { website?: string; instagram?: string; youtube?: string };
  paymentConfig: { gatewayEnabled: boolean; razorpayKeyId?: string; paymentInstructions?: string };
  createdAt: Date;
  updatedAt: Date;
}
export const Settings = model<SettingsDoc>('Settings', settingsSchema);
