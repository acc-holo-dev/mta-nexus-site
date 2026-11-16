import { userRepository } from "@nexus/db";
import type { User } from "@nexus/domain";
import { AppError, ValidationError } from "@nexus/domain";
import { generateId } from "@nexus/security";
import { safeExternalWebUrl } from "@nexus/validation";
import { profileUpdateSchema } from "../user-platform-contract";
export function editableProfile(user: User) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    bio: user.bio ?? "",
    avatarUrl: safeExternalWebUrl(user.avatarUrl) ? (user.avatarUrl ?? "") : "",
    updatedAt: new Date(user.updatedAt).toISOString(),
  };
}
class PublicProfileService {
  async update(input: unknown, actor: User, currentToken: string) {
    const parsed = profileUpdateSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError("Invalid public profile");
    if (parsed.data.expectedActorId !== actor.id)
      throw new AppError("The signed-in account changed", 409, "ACCOUNT_CHANGED");
    const { expectedActorId: _expectedActorId, expectedUpdatedAt, ...fields } = parsed.data;
    const updated = await userRepository.updatePublicProfile(
      actor.id,
      new Date(expectedUpdatedAt),
      fields,
      generateId("aud"),
      currentToken,
    );
    if (!updated) throw new AppError("Profile changed", 409, "CONFLICT");
    return editableProfile(updated);
  }
}
export const publicProfileService = new PublicProfileService();
