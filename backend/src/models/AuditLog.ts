import { model, Schema, type Types } from 'mongoose';
import { createSchema } from './base';

const auditLogSchema = createSchema({
  actor: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  actorRole: { type: String, trim: true },
  action: { type: String, required: true, index: true }, // e.g. student.created
  entity: { type: String, required: true, index: true }, // e.g. StudentProfile
  entityId: { type: Schema.Types.ObjectId, index: true },
  description: { type: String, trim: true, maxlength: 500 },
  changes: { type: Schema.Types.Mixed },
  ip: { type: String, trim: true },
  userAgent: { type: String, trim: true, maxlength: 300 },
});

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entity: 1, entityId: 1 });

export interface AuditLogDoc {
  _id: Types.ObjectId;
  actor?: Types.ObjectId;
  actorRole?: string;
  action: string;
  entity: string;
  entityId?: Types.ObjectId;
  description?: string;
  changes?: unknown;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}
export const AuditLog = model<AuditLogDoc>('AuditLog', auditLogSchema);
