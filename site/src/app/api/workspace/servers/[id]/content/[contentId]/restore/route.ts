import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { userPlatformApi } from "../../../../../../../../features/accounts/user-platform-api";
import {
  serverContentId,
  serverContentRate,
} from "../../../../../../../../features/servers/server-content-api";
import { serverPublicationHistoryError } from "../../../../../../../../features/servers/server-publication-history-copy";
import {
  readBoundedJson,
  requireServerJsonContentType,
} from "../../../../../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../../../../../lib/browser-route-adapter";
import { serverContentService } from "../../../../../../../../lib/services/servers/server-content-service";
export const POST = withBrowserMutation(
  (request: NextRequest, { params }: { params: Promise<{ id: string; contentId: string }> }) => {
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
  },
);
