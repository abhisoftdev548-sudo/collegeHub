import type { Request } from 'express';
import { AuditLog } from '../models';
import { logger } from '../config/logger';

interface AuditInput {
  action: string;
  entity: string;
  entityId?: unknown;
  description?: string;
  changes?: unknown;
}

/**
 * Fire-and-forget audit trail. Auditing must never break the business action,
 * so failures are logged instead of thrown.
 */
export const recordAudit = (req: Request, input: AuditInput): void => {
  const actor = req.user?.id;
  AuditLog.create({
    actor: actor ?? undefined,
    actorRole: req.user?.role,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    description: input.description,
    changes: input.changes,
    ip: req.ip,
    userAgent: req.get('user-agent')?.slice(0, 300),
  }).catch((error) => logger.warn({ err: error }, 'Failed to write audit log'));
};
