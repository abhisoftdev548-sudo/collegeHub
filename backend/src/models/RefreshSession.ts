import { model, Schema, type Types } from 'mongoose';
import { createSchema } from './base';

/**
 * Server-side refresh-session registry. Enables token rotation + revocation
 * without storing access tokens.
 */
const refreshSessionSchema = createSchema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true, index: true },
  familyId: { type: String, required: true, index: true },
  userAgent: { type: String, trim: true, maxlength: 300 },
  ip: { type: String, trim: true, maxlength: 60 },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  revokedAt: { type: Date },
  replacedByTokenHash: { type: String },
});

export interface RefreshSessionDoc {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  tokenHash: string;
  familyId: string;
  userAgent?: string;
  ip?: string;
  expiresAt: Date;
  revokedAt?: Date;
  replacedByTokenHash?: string;
  createdAt: Date;
  updatedAt: Date;
}
export const RefreshSession = model<RefreshSessionDoc>('RefreshSession', refreshSessionSchema);
