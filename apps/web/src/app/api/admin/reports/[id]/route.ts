import type { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
import { userPlatformApi } from "../../../../../lib/user-platform-api";
import {
  communityReportError,
  communityReportDecisionError,
} from "../../../../../lib/community-report-copy";
import { reportId, reportRateLimit } from "../../../../../lib/community-report-api";
import { requireServerJsonContentType, readBoundedJson } from "../../../../../lib/bounded-json";
import { communityReportDecisionSchema } from "../../../../../lib/community-report-contract";
import { communityReportService } from "../../../../../lib/services/community-report-service";
import { withBrowserMutation } from "../../../../../lib/browser-route-adapter";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, context: Context) {
  return userPlatformApi(
    request,
    async (actor) => {
      const id = reportId((await context.params).id);
      await reportRateLimit(actor.id, "search");
      return communityReportService.detail(actor, id, true);
    },
    200,
    communityReportError,
  );
}
export const PATCH = withBrowserMutation(async (request: NextRequest, context: Context) => {
  return userPlatformApi(
    request,
    async (actor) => {
      const id = reportId((await context.params).id);
      requireServerJsonContentType(request);
      const parsed = communityReportDecisionSchema.safeParse(await readBoundedJson(request));
      if (!parsed.success) throw new AppError("Invalid decision", 400, "VALIDATION_ERROR");
      await reportRateLimit(actor.id, "moderationAction");
      const result = await communityReportService.decide(actor, id, parsed.data);
      return {
        id: result.id,
        action: result.action,
        status: result.status,
        removed: result.removed,
      };
    },
    200,
    communityReportDecisionError,
  );
});
