import { resourceRequirementsRepository } from "@nexus/db";
import { AppError, type ResourceRequirementsScope } from "@nexus/domain";
export const resourceRequirementsService = {
  collectionReport(actorId: string, collectionId: string, query: { targetMta?: string }) {
    if (!/^[A-Za-z0-9_-]{1,160}$/u.test(collectionId))
      throw new AppError("Invalid collection", 404, "NOT_FOUND");
    return resourceRequirementsRepository.collectionReport({ actorId, collectionId, ...query });
  },
  report(
    actorId: string,
    productId: string,
    scope: ResourceRequirementsScope,
    query: { targetMta?: string; buildId?: string },
  ) {
    if (!/^[A-Za-z0-9_-]{1,160}$/u.test(productId))
      throw new AppError("Invalid resource", 404, "NOT_FOUND");
    return resourceRequirementsRepository.report({ actorId, productId, scope, ...query });
  },
};
