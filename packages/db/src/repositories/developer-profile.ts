import { createHash } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { AppError, ForbiddenError, NotFoundError } from "@nexus/domain";
import { db } from "../client";
import { auditEvents, developerProfiles, users } from "../schema";
export const developerExperienceRevision = (
  profile: { specialties: string[]; githubUrl: string | null } | null,
) =>
  createHash("sha256")
    .update(JSON.stringify([profile?.specialties ?? [], profile?.githubUrl ?? null]))
    .digest("hex");
const publicFields = {
  specialties: developerProfiles.specialties,
  githubUrl: developerProfiles.githubUrl,
  discordTag: developerProfiles.discordTag,
  verifiedDeveloper: developerProfiles.verifiedDeveloper,
};
class DeveloperProfileRepository {
  async publicProfile(userId: string) {
    const [row] = await db
      .select(publicFields)
      .from(developerProfiles)
      .innerJoin(users, eq(users.id, developerProfiles.userId))
      .where(and(eq(users.id, userId), inArray(users.role, ["developer", "admin"])))
      .limit(1);
    return row ?? null;
  }
  async own(actorId: string) {
    const [row] = await db
      .select({ ...publicFields, updatedAt: users.updatedAt, id: users.id })
      .from(users)
      .leftJoin(developerProfiles, eq(developerProfiles.userId, users.id))
      .where(and(eq(users.id, actorId), inArray(users.role, ["developer", "admin"])))
      .limit(1);
    if (!row) throw new ForbiddenError();
    return {
      ...row,
      specialties: row.specialties ?? [],
      githubUrl: row.githubUrl ?? "",
      discordTag: row.discordTag ?? "",
      verifiedDeveloper: row.verifiedDeveloper ?? false,
    };
  }
  async update(input: {
    actorId: string;
    expectedUpdatedAt: Date;
    specialties: string[];
    githubUrl: string;
    discordTag: string;
    profileId: string;
    auditId: string;
  }) {
    return db.transaction(async (tx) => {
      const [actor] = await tx
        .select({ role: users.role, updatedAt: users.updatedAt })
        .from(users)
        .where(eq(users.id, input.actorId))
        .for("update")
        .limit(1);
      if (!actor) throw new NotFoundError("User");
      if (!["developer", "admin"].includes(actor.role)) throw new ForbiddenError();
      if (actor.updatedAt.getTime() !== input.expectedUpdatedAt.getTime())
        throw new AppError("Profile changed", 409, "CONFLICT");
      const [previous] = await tx
        .select(publicFields)
        .from(developerProfiles)
        .where(eq(developerProfiles.userId, input.actorId))
        .for("update")
        .limit(1);
      const fields = {
        specialties: input.specialties,
        githubUrl: input.githubUrl || null,
        discordTag: input.discordTag || null,
      };
      const changed =
        developerExperienceRevision(previous ?? null) !== developerExperienceRevision(fields);
      const verifiedDeveloper = !!previous?.verifiedDeveloper && !changed;
      await tx
        .insert(developerProfiles)
        .values({ id: input.profileId, userId: input.actorId, ...fields, verifiedDeveloper })
        .onConflictDoUpdate({
          target: developerProfiles.userId,
          set: { ...fields, verifiedDeveloper },
        });
      const [updated] = await tx
        .update(users)
        .set({
          updatedAt: sql`greatest(clock_timestamp(), date_trunc('milliseconds', ${users.updatedAt}) + interval '1 millisecond')`,
        })
        .where(eq(users.id, input.actorId))
        .returning({ updatedAt: users.updatedAt });
      await tx
        .insert(auditEvents)
        .values({
          id: input.auditId,
          actorId: input.actorId,
          actorType: "user",
          action: "developer.profile_updated",
          targetType: "user",
          targetId: input.actorId,
          details: {
            fields: ["specialties", "githubUrl", "discordTag"],
            experienceVerificationInvalidated: !!previous?.verifiedDeveloper && changed,
          },
        });
      return {
        id: input.actorId,
        ...fields,
        githubUrl: input.githubUrl,
        discordTag: input.discordTag,
        verifiedDeveloper,
        updatedAt: updated.updatedAt,
      };
    });
  }
}
export const developerProfileRepository = new DeveloperProfileRepository();
