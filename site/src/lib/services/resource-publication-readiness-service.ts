import { resourcePublicationReadinessRepository } from "@nexus/db";
import { AppError, NotFoundError, type User } from "@nexus/domain";

export const resourcePublicationReadinessService = {
  async summary(productId: string, actor: User) {
    if (!/^[A-Za-z0-9_-]{1,160}$/u.test(productId)) {
      throw new AppError("Invalid resource", 404, "NOT_FOUND");
    }
    try {
      return await resourcePublicationReadinessRepository.summary(productId, actor);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new AppError("Resource not found", 404, "NOT_FOUND");
      }
      throw error;
    }
  },
};
