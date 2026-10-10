import { and, eq } from "drizzle-orm";
import { AppError, ForbiddenError, NotFoundError } from "@nexus/domain";
import type { db } from "../client";
import { developerProfiles, organizationMembers, organizations, users } from "../schema";
import { developerExperienceRevision } from "./developer-profile";
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function verificationTargetAuthority(
  tx: Tx,
  requesterId: string,
  type: string,
  targetId: string,
  applying: boolean,
) {
  if (type === "organization") {
    const [org] = await tx
      .select({ ownerId: organizations.ownerId, verified: organizations.isVerified })
      .from(organizations)
      .where(eq(organizations.id, targetId))
      .for(applying ? "share" : "update")
      .limit(1);
    if (!org)
      throw applying
        ? new NotFoundError("Organization")
        : new AppError("Target missing", 409, "CONFLICT");
    if (org.ownerId !== requesterId) {
      const [member] = await tx
        .select({ role: organizationMembers.role })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, targetId),
            eq(organizationMembers.userId, requesterId),
          ),
        )
        .for("share")
        .limit(1);
      if (member?.role !== "admin")
        throw new AppError(
          "Organization authority changed",
          applying ? 403 : 409,
          "VERIFICATION_AUTHORITY_CHANGED",
        );
    }
    if (applying && org.verified)
      throw new AppError("Already verified", 409, "VERIFICATION_ALREADY_VERIFIED");
    return null;
  }
  if (!["user", "developer"].includes(type) || requesterId !== targetId) throw new ForbiddenError();
  // Approval mutates this same user. Acquire UPDATE rather than upgrading SHARE;
  // simultaneous identity/experience approvals cannot deadlock on lock upgrade.
  const [actor] = await tx
    .select({ role: users.role, verified: users.isVerified })
    .from(users)
    .where(eq(users.id, targetId))
    .for(applying ? "share" : "update")
    .limit(1);
  if (!actor)
    throw applying ? new NotFoundError("User") : new AppError("Target missing", 409, "CONFLICT");
  if (type === "developer") {
    if (!["developer", "admin"].includes(actor.role))
      throw new AppError(
        "Developer role required",
        applying ? 403 : 409,
        "VERIFICATION_AUTHORITY_CHANGED",
      );
    const [profile] = await tx
      .select({
        specialties: developerProfiles.specialties,
        githubUrl: developerProfiles.githubUrl,
        verifiedDeveloper: developerProfiles.verifiedDeveloper,
      })
      .from(developerProfiles)
      .where(eq(developerProfiles.userId, targetId))
      .for("share")
      .limit(1);
    if (!profile?.specialties.length)
      throw new AppError(
        "Developer profile required",
        applying ? 422 : 409,
        "VERIFICATION_PROFILE_REQUIRED",
      );
    if (applying && profile.verifiedDeveloper)
      throw new AppError("Already verified", 409, "VERIFICATION_ALREADY_VERIFIED");
    return developerExperienceRevision(profile);
  }
  if (applying && actor.verified)
    throw new AppError("Already verified", 409, "VERIFICATION_ALREADY_VERIFIED");
  return null;
}
