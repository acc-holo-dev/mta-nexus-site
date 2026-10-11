import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import {
  readBoundedJson,
  requireServerJsonContentType,
} from "../../../../../../../../lib/bounded-json";
import {
  organizationContentId,
  organizationContentRate,
} from "../../../../../../../../lib/organization-content-api";
import { organizationPublicationHistoryError } from "../../../../../../../../lib/organization-publication-history-copy";
import { organizationContentService } from "../../../../../../../../lib/services/organization-content-service";
import { userPlatformApi } from "../../../../../../../../lib/user-platform-api";
export function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contentId: string }> },
) {
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
}
