import { profilePrivacyRepository } from "@nexus/db";
import { NotFoundError } from "@nexus/domain";
import type { User } from "@nexus/domain";
import { generateId } from "@nexus/security";
import type { z } from "zod";
import type { profilePrivacyUpdateSchema } from "../profile-privacy-contract";

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
  async update(actor: User, fields: z.infer<typeof profilePrivacyUpdateSchema>) {
    return editable(
      await profilePrivacyRepository.update({
        actorId: actor.id,
        showActivity: fields.showActivity,
        showProfessionalContacts: fields.showProfessionalContacts,
        expectedUpdatedAt: new Date(fields.expectedUpdatedAt),
        auditId: generateId("aud"),
      }),
    );
  }
}
export const profilePrivacyService = new ProfilePrivacyService();
