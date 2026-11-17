import { profilePrivacyRepository } from "@nexus/db";
import type { User } from "@nexus/domain";
import { AppError, NotFoundError } from "@nexus/domain";
import { generateId } from "@nexus/security";
import type { z } from "zod";
import type { profilePrivacyUpdateSchema } from "../../../features/accounts/profile-privacy-contract";
import { isPostgresDeadlock } from "../../platform/postgres-error";

const editable = (row: Awaited<ReturnType<typeof profilePrivacyRepository.own>>) => ({
  id: row.id,
  username: row.username,
  showActivity: row.showActivity,
  showProfessionalContacts: row.showProfessionalContacts,
  updatedAt: row.updatedAt.toISOString(),
});

class ProfilePrivacyService {
  async own(actor: User) {
    return editable(await profilePrivacyRepository.own(actor.id));
  }
  async visibility(userId: string) {
    const row = await profilePrivacyRepository.visibility(userId);
    if (!row) throw new NotFoundError("User");
    return {
      showActivity: row.showActivity,
      showProfessionalContacts: row.showProfessionalContacts,
    };
  }
  async update(
    actor: User,
    fields: z.infer<typeof profilePrivacyUpdateSchema>,
    currentToken: string,
  ) {
    if (fields.expectedActorId !== actor.id)
      throw new AppError("Account changed", 409, "ACCOUNT_CHANGED");
    try {
      return editable(
        await profilePrivacyRepository.update({
          actorId: actor.id,
          currentToken,
          showActivity: fields.showActivity,
          showProfessionalContacts: fields.showProfessionalContacts,
          expectedUpdatedAt: new Date(fields.expectedUpdatedAt),
          auditId: generateId("aud"),
        }),
      );
    } catch (error) {
      if (isPostgresDeadlock(error))
        throw new AppError("Please retry saving privacy settings", 409, "PRIVACY_SAVE_RETRY");
      throw error;
    }
  }
}
export const profilePrivacyService = new ProfilePrivacyService();
