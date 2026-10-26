import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import {
  readBoundedJson,
  requireServerJsonContentType,
} from "../../../../../../../../lib/bounded-json";
import { serverContentId, serverContentRate } from "../../../../../../../../lib/server-content-api";
import { serverPublicationHistoryError } from "../../../../../../../../lib/server-publication-history-copy";
import { serverContentService } from "../../../../../../../../lib/services/server-content-service";
import { userPlatformApi } from "../../../../../../../../lib/user-platform-api";
import { withBrowserMutation } from "../../../../../../../../lib/browser-route-adapter";
export const POST = withBrowserMutation((
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contentId: string }> },
) => {
  return userPlatformApi(
    request,
    async (actor) => {
      if (request.nextUrl.searchParams.size)
        throw new AppError("Unexpected restore filters", 400, "VALIDATION_ERROR");
      requireServerJsonContentType(request);
      await serverContentRate(actor.id, "contentEditing");
      const scope = await params;
      return serverContentService.restore(
        serverContentId(scope.id),
        actor,
        serverContentId(scope.contentId),
        await readBoundedJson(request, 1024),
      );
    },
    200,
    serverPublicationHistoryError,
  );
});
