import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { userPlatformApi } from "../../../../../../../../features/accounts/user-platform-api";
import { parseAuthorPublicationHistoryQuery } from "../../../../../../../../features/community/author-publication-desk-contract";
import {
  serverContentId,
  serverContentRate,
} from "../../../../../../../../features/servers/server-content-api";
import { serverPublicationHistoryError } from "../../../../../../../../features/servers/server-publication-history-copy";
import { serverContentService } from "../../../../../../../../lib/services/server-content-service";
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
