import { AppError, UnauthorizedError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { readBoundedJson, requireServerJsonContentType } from "../../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../../lib/browser-route-adapter";
import { reportId, reportRateLimit } from "../../../../../lib/community-report-api";
import { communityReportDecisionSchema } from "../../../../../lib/community-report-contract";
import {
  communityReportDecisionError,
  communityReportError,
} from "../../../../../lib/community-report-copy";
import { communityReportService } from "../../../../../lib/services/community-report-service";
import { userPlatformApi } from "../../../../../lib/user-platform-api";

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
      const currentToken = request.cookies.get("nexus_session")?.value;
      if (!currentToken) throw new UnauthorizedError();
      const id = reportId((await context.params).id);
      requireServerJsonContentType(request);
      const parsed = communityReportDecisionSchema.safeParse(await readBoundedJson(request));
      if (!parsed.success) throw new AppError("Invalid decision", 400, "VALIDATION_ERROR");
      await reportRateLimit(actor.id, "moderationAction");
      const result = await communityReportService.decide(actor, id, parsed.data, currentToken);
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
