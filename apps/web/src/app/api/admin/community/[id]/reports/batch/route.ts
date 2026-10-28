import { AppError, UnauthorizedError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import {
  readBoundedJson,
  requireServerJsonContentType,
} from "../../../../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../../../../lib/browser-route-adapter";
import { reportRateLimit } from "../../../../../../../lib/community-report-api";
import { reportBatchError } from "../../../../../../../lib/report-batch-copy";
import { communityReportService } from "../../../../../../../lib/services/community-report-service";
import { userPlatformApi } from "../../../../../../../lib/user-platform-api";
export const POST = withBrowserMutation(
  (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    return userPlatformApi(
      request,
      async (actor) => {
        const currentToken = request.cookies.get("nexus_session")?.value;
        if (!currentToken) throw new UnauthorizedError();
        if (request.nextUrl.searchParams.size)
          throw new AppError("Unexpected batch filters", 400, "VALIDATION_ERROR");
        requireServerJsonContentType(request);
        await reportRateLimit(actor.id, "moderationAction");
        const result = await communityReportService.decidePublicationBatch(
          actor,
          (await params).id,
          await readBoundedJson(request, 8192),
          currentToken,
        );
        return {
          contentId: result.contentId,
          commentId: result.commentId,
          action: result.action,
          previewRevision: result.previewRevision,
          items: result.items.map((item) => ({ id: item.id, status: item.status })),
        };
      },
      200,
      reportBatchError,
    );
  },
);
