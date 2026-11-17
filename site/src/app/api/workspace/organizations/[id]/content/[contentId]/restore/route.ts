import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { userPlatformApi } from "../../../../../../../../features/accounts/user-platform-api";
import {
  organizationContentId,
  organizationContentRate,
} from "../../../../../../../../features/organizations/organization-content-api";
import { organizationPublicationHistoryError } from "../../../../../../../../features/organizations/organization-publication-history-copy";
import {
  readBoundedJson,
  requireServerJsonContentType,
} from "../../../../../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../../../../../lib/browser-route-adapter";
import { organizationContentService } from "../../../../../../../../lib/services/organizations/organization-content-service";
export const POST = withBrowserMutation(
  (request: NextRequest, { params }: { params: Promise<{ id: string; contentId: string }> }) => {
    return userPlatformApi(
      request,
      async (actor) => {
        if (request.nextUrl.searchParams.size)
          throw new AppError("Unexpected restore filters", 400, "VALIDATION_ERROR");
        requireServerJsonContentType(request);
        await organizationContentRate(actor.id, "contentEditing");
        const scope = await params;
        return organizationContentService.restore(
          organizationContentId(scope.id),
          actor,
          organizationContentId(scope.contentId),
          await readBoundedJson(request, 1024),
        );
      },
      200,
      organizationPublicationHistoryError,
    );
  },
);
