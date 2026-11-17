import { buildPackageComparisonRepository } from "@nexus/db";
import type { User } from "@nexus/domain";
import type { parseBuildPackageQuery } from "../../features/resources/build-package-query";
export const buildPackageService = {
  page(
    actor: User,
    productId: string,
    buildId: string,
    query: NonNullable<ReturnType<typeof parseBuildPackageQuery>>,
    staff = false,
  ) {
    return buildPackageComparisonRepository.page({
      actorId: actor.id,
      productId,
      buildId,
      ...query,
      staff,
    });
  },
};
