import { contentRepository } from "@nexus/db";

export const communityTopicRecoveryService = {
  findOwned(slug: string, actorId: string) {
    return contentRepository.findOwnCommunityTopicBySlug(slug, actorId);
  },
};
