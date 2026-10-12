import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import {
  readBoundedJson,
  requireServerJsonContentType,
} from "../../../../../../../lib/bounded-json";
import { reportRateLimit } from "../../../../../../../lib/community-report-api";
import { reportBatchError } from "../../../../../../../lib/report-batch-copy";
import { queueCommunityReportBatchNotices } from "../../../../../../../lib/services/community-report-notifications";
import { communityReportService } from "../../../../../../../lib/services/community-report-service";
import { userPlatformApi } from "../../../../../../../lib/user-platform-api";
export function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return userPlatformApi(
    request,
    async (actor) => {
      if (request.nextUrl.searchParams.size)
        throw new AppError("Unexpected batch filters", 400, "VALIDATION_ERROR");
      requireServerJsonContentType(request);
      await reportRateLimit(actor.id, "moderationAction");
      const result = await communityReportService.decidePublicationBatch(
        actor,
        (await params).id,
        await readBoundedJson(request, 8192),
      );
      queueCommunityReportBatchNotices(result.items);
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
}
