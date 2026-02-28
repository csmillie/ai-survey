import { prisma } from "@/lib/db";
import type { Survey, ShareRole } from "@prisma/client";

/**
 * Role hierarchy: EDIT includes VIEW permission.
 */
const ROLE_LEVEL: Record<ShareRole, number> = {
  VIEW: 1,
  EDIT: 2,
};

/**
 * Check whether a user can access a survey with at least the given role.
 *
 * Access is granted if any of the following are true:
 *  - The user is the survey owner.
 *  - The user has a SurveyShare with an equal or higher role.
 *  - The user has the ADMIN role.
 *
 * @param userId       - ID of the user requesting access.
 * @param surveyId     - ID of the survey to check.
 * @param requiredRole - Minimum role required (defaults to "VIEW").
 * @returns `true` if the user has sufficient access, `false` otherwise.
 */
export async function canAccessSurvey(
  userId: string,
  surveyId: string,
  requiredRole: ShareRole = "VIEW"
): Promise<boolean> {
  // Check if user is ADMIN (bypasses all checks)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user) return false;
  if (user.role === "ADMIN") return true;

  // Check if user is the owner
  const survey = await prisma.survey.findUnique({
    where: { id: surveyId, deletedAt: null },
    select: { ownerId: true },
  });

  if (!survey) return false;
  if (survey.ownerId === userId) return true;

  // Check SurveyShare
  const share = await prisma.surveyShare.findUnique({
    where: {
      surveyId_userId: { surveyId, userId },
    },
    select: { role: true },
  });

  if (!share) return false;

  return ROLE_LEVEL[share.role] >= ROLE_LEVEL[requiredRole];
}

/**
 * Require that a user can access a survey with at least the given role.
 *
 * @param userId       - ID of the user requesting access.
 * @param surveyId     - ID of the survey to check.
 * @param requiredRole - Minimum role required (defaults to "VIEW").
 * @returns The survey if access is granted.
 * @throws Error if access is denied or the survey does not exist.
 */
export async function requireSurveyAccess(
  userId: string,
  surveyId: string,
  requiredRole: ShareRole = "VIEW"
): Promise<Survey> {
  const hasAccess = await canAccessSurvey(userId, surveyId, requiredRole);
  if (!hasAccess) {
    throw new Error("Access denied: insufficient permissions for this survey");
  }

  const survey = await prisma.survey.findUnique({
    where: { id: surveyId, deletedAt: null },
  });

  if (!survey) {
    throw new Error("Survey not found");
  }

  return survey;
}
