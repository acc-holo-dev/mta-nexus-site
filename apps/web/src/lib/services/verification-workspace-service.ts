import {
  developerProfileRepository,
  verificationRepository,
  verificationWorkspaceRepository,
} from "@nexus/db";
import type { User } from "@nexus/domain";
import { AppError, ForbiddenError, NotFoundError } from "@nexus/domain";
import { can, generateId } from "@nexus/security";
import { safeExternalWebUrl } from "@nexus/validation";
import type { z } from "zod";
import type {
  VerificationQuery,
  developerProfileUpdateSchema,
  verificationApplicationSchema,
  verificationDecisionSchema,
} from "../verification-workspace-contract";
const editable = (row: Awaited<ReturnType<typeof developerProfileRepository.own>>) => ({
  id: row.id,
  specialties: row.specialties,
  discordTag: row.discordTag,
  verifiedDeveloper: row.verifiedDeveloper,
  githubUrl: safeExternalWebUrl(row.githubUrl) ?? "",
  updatedAt: row.updatedAt.toISOString(),
});
class VerificationWorkspaceService {
  async overview(actor: User, filters: VerificationQuery) {
    const [profile, history] = await Promise.all([
      verificationWorkspaceRepository.profile(actor.id),
      verificationWorkspaceRepository.history(actor.id, filters),
    ]);
    if (!profile) throw new NotFoundError("User");
    return {
      profile: {
        id: profile.id,
        username: profile.username,
        name: profile.name,
        role: profile.role,
        identityVerified: profile.identityVerified,
        experienceVerified: !!profile.experienceVerified,
        hasSpecialties: profile.hasSpecialties,
        identityPending: profile.identityPending,
        experiencePending: profile.experiencePending,
      },
      history: {
        page: history.page,
        view: history.view,
        hasMore: history.hasMore,
        items: history.items.map((row) => ({
          id: row.id,
          targetType: row.targetType,
          targetId: row.targetId,
          status: row.status,
          notes: row.notes,
          reviewNotes: row.reviewNotes,
          proofUrl: safeExternalWebUrl(row.proofUrl) ?? null,
          createdAt: row.createdAt.toISOString(),
          resolvedAt: row.resolvedAt?.toISOString() ?? null,
        })),
      },
    };
  }
  targets(actor: User, filters: VerificationQuery) {
    return verificationWorkspaceRepository.targets(actor.id, filters.page, filters.query);
  }
  async ownProfile(actor: User) {
    return editable(await developerProfileRepository.own(actor.id));
  }
  async updateProfile(actor: User, input: z.infer<typeof developerProfileUpdateSchema>) {
    const row = await developerProfileRepository.update({
      ...input,
      actorId: actor.id,
      expectedUpdatedAt: new Date(input.expectedUpdatedAt),
      profileId: generateId("dev"),
      auditId: generateId("aud"),
    });
    return editable(row);
  }
  async publicProfile(id: string) {
    const profile = await developerProfileRepository.publicProfile(id);
    return profile
      ? {
          specialties: profile.specialties.slice(0, 12),
          githubUrl: safeExternalWebUrl(profile.githubUrl) ?? null,
          discordTag: profile.discordTag?.slice(0, 80) ?? null,
          verifiedDeveloper: profile.verifiedDeveloper,
        }
      : null;
  }
  async apply(actor: User, input: z.infer<typeof verificationApplicationSchema>) {
    if (input.targetType !== "organization" && input.targetId !== actor.id)
      throw new ForbiddenError();
    let row: Awaited<ReturnType<typeof verificationRepository.createRequest>>;
    try {
      row = await verificationRepository.createRequest(
        { ...input, requesterId: actor.id },
        {
          id: generateId("aud"),
          actorId: actor.id,
          actorType: "user",
          action: "verification.requested",
          details: { targetType: input.targetType, targetId: input.targetId },
        },
      );
    } catch (error) {
      if (error instanceof AppError && error.code === "CONFLICT")
        throw new AppError("Pending application", 409, "VERIFICATION_PENDING");
      throw error;
    }
    return { id: row.id, targetType: row.targetType, targetId: row.targetId, status: row.status };
  }
  async decide(actor: User, id: string, input: z.infer<typeof verificationDecisionSchema>) {
    if (!can(actor, "admin.moderation")) throw new ForbiddenError();
    const row = await verificationRepository.resolveRequest(
      { ...input, id, reviewerId: actor.id },
      {
        id: generateId("aud"),
        actorId: actor.id,
        actorType: "admin",
        action: `verification.${input.decision}`,
        targetType: "verification",
        targetId: id,
        details: { notes: input.reviewNotes },
      },
    );
    if (!row) throw new AppError("Application changed", 409, "VERIFICATION_STATE_CHANGED");
    return { id: row.id, status: row.status };
  }
}
export const verificationWorkspaceService = new VerificationWorkspaceService();
