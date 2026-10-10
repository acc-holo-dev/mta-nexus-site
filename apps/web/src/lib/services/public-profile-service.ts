import { userRepository } from "@nexus/db";
import { AppError, ValidationError } from "@nexus/domain";
import type { User } from "@nexus/domain";
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
  async update(input: unknown, actor: User) {
    const parsed = profileUpdateSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError("Invalid public profile");
    const updated = await userRepository.updatePublicProfile(
      actor.id,
      new Date(parsed.data.expectedUpdatedAt),
      parsed.data,
      generateId("aud"),
    );
    if (!updated) throw new AppError("Profile changed", 409, "CONFLICT");
    return editableProfile(updated);
  }
}
export const publicProfileService = new PublicProfileService();
