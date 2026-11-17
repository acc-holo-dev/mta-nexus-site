import type { PublicationScope } from "@nexus/db";
import { AppError } from "@nexus/domain";
import { publicationFeedService } from "../../lib/services/discovery/publication-feed-service";
import { parsePublicationPageQuery, publicationPageQuery } from "./publication-feed-contract";
export async function publicationFeedView(
  scope: PublicationScope,
  params: Record<string, string | string[] | undefined> = {},
) {
  const following = scope.kind === "following";
  const filters = parsePublicationPageQuery(params, following, scope.kind === "server");
  if (!filters)
    return {
      filters: publicationPageQuery(params, following),
      initial: null,
      errorCode: "VALIDATION_ERROR",
    };
  try {
    return {
      filters,
      initial: await publicationFeedService.page(scope, filters),
      errorCode: undefined,
    };
  } catch (error) {
    return {
      filters,
      initial: null,
      errorCode: error instanceof AppError ? error.code : "INTERNAL_ERROR",
    };
  }
}
