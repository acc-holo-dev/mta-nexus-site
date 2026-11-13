import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { readBoundedJson, requireServerJsonContentType } from "../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../lib/browser-route-adapter";
import { reportFilters, reportRateLimit } from "../../../../lib/community-report-api";
import { communityReportCreateSchema } from "../../../../lib/community-report-contract";
import {
  communityReportError,
  communityReportMutationError,
} from "../../../../lib/community-report-copy";
import { communityReportService } from "../../../../lib/services/community-report-service";
import { userPlatformApi } from "../../../../lib/user-platform-api";
export async function GET(request: NextRequest) {
  return userPlatformApi(
    request,
    async (actor) => {
      const filters = reportFilters(request.nextUrl.searchParams);
      await reportRateLimit(actor.id, "search");
      return communityReportService.page(actor, filters);
    },
    200,
    communityReportError,
  );
}
export const POST = withBrowserMutation(async (request: NextRequest) => {
  return userPlatformApi(
    request,
    async (actor) => {
      const expectedActor = request.headers.get("x-nexus-actor-id");
      if (!expectedActor)
        throw new AppError("Actor precondition required", 428, "ACTOR_ID_REQUIRED");
      if (expectedActor !== actor.id) throw new AppError("Actor changed", 409, "ACTOR_CHANGED");
      requireServerJsonContentType(request);
      const parsed = communityReportCreateSchema.safeParse(await readBoundedJson(request));
      if (!parsed.success) throw new AppError("Invalid report", 400, "VALIDATION_ERROR");
      await reportRateLimit(actor.id, "report");
      return communityReportService.submit(
        actor,
        parsed.data,
        request.cookies.get("nexus_session")?.value ?? "",
      );
    },
    200,
    communityReportMutationError,
  );
});
