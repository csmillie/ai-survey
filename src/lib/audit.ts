import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Action constants
// ---------------------------------------------------------------------------

export const LOGIN_SUCCESS = "LOGIN_SUCCESS" as const;
export const LOGIN_FAILED = "LOGIN_FAILED" as const;
export const LOGOUT = "LOGOUT" as const;

export const SURVEY_CREATED = "SURVEY_CREATED" as const;
export const SURVEY_UPDATED = "SURVEY_UPDATED" as const;
export const SURVEY_DELETED = "SURVEY_DELETED" as const;

export const QUESTION_CREATED = "QUESTION_CREATED" as const;
export const QUESTION_UPDATED = "QUESTION_UPDATED" as const;
export const QUESTION_DELETED = "QUESTION_DELETED" as const;

export const VARIABLE_CREATED = "VARIABLE_CREATED" as const;
export const VARIABLE_UPDATED = "VARIABLE_UPDATED" as const;
export const VARIABLE_DELETED = "VARIABLE_DELETED" as const;

export const SHARE_ADDED = "SHARE_ADDED" as const;
export const SHARE_REMOVED = "SHARE_REMOVED" as const;
export const SHARE_UPDATED = "SHARE_UPDATED" as const;

export const RUN_STARTED = "RUN_STARTED" as const;
export const RUN_CANCELLED = "RUN_CANCELLED" as const;
export const RUN_COMPLETED = "RUN_COMPLETED" as const;
export const RUN_FAILED = "RUN_FAILED" as const;

export const EXPORT_CREATED = "EXPORT_CREATED" as const;

export const PROFILE_UPDATED = "PROFILE_UPDATED" as const;
export const PASSWORD_CHANGED = "PASSWORD_CHANGED" as const;
export const ACCOUNT_DISABLED = "ACCOUNT_DISABLED" as const;

export type AuditAction =
  | typeof LOGIN_SUCCESS
  | typeof LOGIN_FAILED
  | typeof LOGOUT
  | typeof SURVEY_CREATED
  | typeof SURVEY_UPDATED
  | typeof SURVEY_DELETED
  | typeof QUESTION_CREATED
  | typeof QUESTION_UPDATED
  | typeof QUESTION_DELETED
  | typeof VARIABLE_CREATED
  | typeof VARIABLE_UPDATED
  | typeof VARIABLE_DELETED
  | typeof SHARE_ADDED
  | typeof SHARE_REMOVED
  | typeof SHARE_UPDATED
  | typeof RUN_STARTED
  | typeof RUN_CANCELLED
  | typeof RUN_COMPLETED
  | typeof RUN_FAILED
  | typeof EXPORT_CREATED
  | typeof PROFILE_UPDATED
  | typeof PASSWORD_CHANGED
  | typeof ACCOUNT_DISABLED;

// ---------------------------------------------------------------------------
// Audit event creation
// ---------------------------------------------------------------------------

interface CreateAuditEventParams {
  actorUserId: string;
  action: AuditAction;
  targetType: string;
  targetId: string;
  meta?: Prisma.InputJsonValue;
  ip?: string;
  userAgent?: string;
  runTargetId?: string;
}

/**
 * Create an audit event in the database.
 */
export async function createAuditEvent(
  params: CreateAuditEventParams
): Promise<void> {
  const {
    actorUserId,
    action,
    targetType,
    targetId,
    meta,
    ip,
    userAgent,
    runTargetId,
  } = params;

  await prisma.auditEvent.create({
    data: {
      actorUserId,
      action,
      targetType,
      targetId,
      metaJson: meta ?? undefined,
      ip: ip ?? undefined,
      userAgent: userAgent ?? undefined,
      runTargetId: runTargetId ?? undefined,
    },
  });
}
