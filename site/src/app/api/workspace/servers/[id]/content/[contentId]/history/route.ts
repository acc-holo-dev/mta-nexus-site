import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { parseAuthorPublicationHistoryQuery } from "../../../../../../../../lib/author-publication-desk-contract";
import { serverContentId, serverContentRate } from "../../../../../../../../lib/server-content-api";
import { serverPublicationHistoryError } from "../../../../../../../../lib/server-publication-history-copy";
import { serverContentService } from "../../../../../../../../lib/services/server-content-service";
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
      await serverContentRate(actor.id, "search");
      const scope = await params;
      return serverContentService.history(
        serverContentId(scope.id),
        actor,
        serverContentId(scope.contentId),
        filters,
      );
    },
    200,
    serverPublicationHistoryError,
  );
}
