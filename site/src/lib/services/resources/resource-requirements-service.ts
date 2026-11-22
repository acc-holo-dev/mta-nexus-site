import { resourceRequirementsRepository } from "@nexus/db";
import { AppError, type ResourceRequirementsScope } from "@nexus/domain";
import { isWalletEngineEnabled } from "../commerce/wallet-payment-service";
export const resourceRequirementsService = {
  collectionReport(actorId: string, collectionId: string, query: { targetMta?: string }) {
    if (!/^[A-Za-z0-9_-]{1,160}$/u.test(collectionId))
      throw new AppError("Invalid collection", 404, "NOT_FOUND");
    return resourceRequirementsRepository.collectionReport({
      actorId,
      collectionId,
      ...query,
      allowPaid: isWalletEngineEnabled(),
    });
  },
  report(
    actorId: string,
    productId: string,
    scope: ResourceRequirementsScope,
    query: {
      targetMta?: string;
      buildId?: string;
      previewBuildId?: string;
      returnFrom?: string;
      returnPage?: number;
    },
  ) {
    if (!/^[A-Za-z0-9_-]{1,160}$/u.test(productId))
      throw new AppError("Invalid resource", 404, "NOT_FOUND");
    return resourceRequirementsRepository.report({
      actorId,
      productId,
      scope,
      targetMta: query.targetMta,
      buildId: query.buildId,
      previewBuildId: query.previewBuildId,
      allowPaid: isWalletEngineEnabled(),
    });
  },
};
