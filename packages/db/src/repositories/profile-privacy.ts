import { eq, sql } from "drizzle-orm";
import { AppError, NotFoundError } from "@nexus/domain";
import { db } from "../client";
import { auditEvents, userProfilePreferences, users } from "../schema";

const preferences = {
  showActivity: sql<boolean>`coalesce(${userProfilePreferences.showActivity}, true)`,
  showProfessionalContacts: sql<boolean>`coalesce(${userProfilePreferences.showProfessionalContacts}, true)`,
};

class ProfilePrivacyRepository {
  async own(actorId: string) {
    const [row] = await db
      .select({
        id: users.id,
        username: users.username,
        updatedAt: users.updatedAt,
        ...preferences,
      })
      .from(users)
      .leftJoin(userProfilePreferences, eq(userProfilePreferences.userId, users.id))
      .where(eq(users.id, actorId))
      .limit(1);
    if (!row) throw new NotFoundError("User");
    return row;
  }

  async visibility(userId: string) {
    const [row] = await db
      .select(preferences)
      .from(users)
      .leftJoin(userProfilePreferences, eq(userProfilePreferences.userId, users.id))
      .where(eq(users.id, userId))
      .limit(1);
    return row ?? null;
  }

  async update(input: {
    actorId: string;
    expectedUpdatedAt: Date;
    showActivity: boolean;
    showProfessionalContacts: boolean;
    auditId: string;
  }) {
    return db.transaction(async (tx) => {
      // All profile editors serialize through this row and share its revision.
      const [actor] = await tx
        .select({ id: users.id, username: users.username, updatedAt: users.updatedAt })
        .from(users)
        .where(eq(users.id, input.actorId))
        .for("update")
        .limit(1);
      if (!actor) throw new NotFoundError("User");
      if (actor.updatedAt.getTime() !== input.expectedUpdatedAt.getTime())
        throw new AppError("Profile changed", 409, "CONFLICT");
      const fields = {
        showActivity: input.showActivity,
        showProfessionalContacts: input.showProfessionalContacts,
      };
      await tx
        .insert(userProfilePreferences)
        .values({ userId: actor.id, ...fields })
        .onConflictDoUpdate({ target: userProfilePreferences.userId, set: fields });
      const [updated] = await tx
        .update(users)
        .set({
          updatedAt: sql`greatest(clock_timestamp(), date_trunc('milliseconds', ${users.updatedAt}) + interval '1 millisecond')`,
        })
        .where(eq(users.id, actor.id))
        .returning({ updatedAt: users.updatedAt });
      await tx.insert(auditEvents).values({
        id: input.auditId,
        actorId: actor.id,
        actorType: "user",
        targetType: "user",
        targetId: actor.id,
        action: "user.privacy_updated",
        details: { fields: ["showActivity", "showProfessionalContacts"] },
      });
      return { id: actor.id, username: actor.username, ...fields, updatedAt: updated.updatedAt };
    });
  }
}

export const profilePrivacyRepository = new ProfilePrivacyRepository();
