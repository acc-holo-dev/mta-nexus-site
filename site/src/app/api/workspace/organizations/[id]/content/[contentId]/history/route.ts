import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { parseAuthorPublicationHistoryQuery } from "../../../../../../../../lib/author-publication-desk-contract";
import {
  organizationContentId,
  organizationContentRate,
} from "../../../../../../../../lib/organization-content-api";
import { organizationPublicationHistoryError } from "../../../../../../../../lib/organization-publication-history-copy";
import { organizationContentService } from "../../../../../../../../lib/services/organization-content-service";
import { userPlatformApi } from "../../../../../../../../lib/user-platform-api";
export function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contentId: string }> },
) {
  return userPlatformApi(
    request,
    async (actor) => {
      const filters = parseAuthorPublicationHistoryQuery(request.nextUrl.searchParams);
      if (!filters) throw new AppError("Invalid history filters", 400, "VALIDATION_ERROR");
      await organizationContentRate(actor.id, "search");
      const scope = await params;
      return organizationContentService.history(
        organizationContentId(scope.id),
        actor,
        organizationContentId(scope.contentId),
        filters,
      );
    },
    200,
    organizationPublicationHistoryError,
  );
}
