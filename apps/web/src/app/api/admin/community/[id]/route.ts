import type { NextRequest } from "next/server";
import { AppError, UnauthorizedError } from "@nexus/domain";
import { userPlatformApi } from "../../../../../lib/user-platform-api";
import {
  parseModerationDetailQuery,
  moderationCommandSchema,
} from "../../../../../lib/community-moderation-contract";
import { moderationError } from "../../../../../lib/community-moderation-copy";
import { reportRateLimit } from "../../../../../lib/community-report-api";
import { communityModerationService } from "../../../../../lib/services/community-moderation-service";
import { readBoundedJson, requireServerJsonContentType } from "../../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../../lib/browser-route-adapter";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, { params }: Context) {
  return userPlatformApi(
    request,
    async (actor) => {
      const filters = parseModerationDetailQuery(request.nextUrl.searchParams);
      if (!filters) throw new AppError("Invalid history filters", 400, "VALIDATION_ERROR");
      await reportRateLimit(actor.id, "search");
      return communityModerationService.detail(actor, (await params).id, filters.cursor);
    },
    200,
    moderationError,
  );
}
export const POST = withBrowserMutation(async (request: NextRequest, { params }: Context) => {
  return userPlatformApi(
    request,
    async (actor) => {
      if (request.nextUrl.searchParams.size)
        throw new AppError("Unexpected command filters", 400, "VALIDATION_ERROR");
      requireServerJsonContentType(request);
      await reportRateLimit(actor.id, "moderationAction");
      const parsed = moderationCommandSchema.safeParse(await readBoundedJson(request, 16384));
      if (!parsed.success)
        throw new AppError("Invalid moderation command", 400, "VALIDATION_ERROR");
      const token = request.cookies.get("nexus_session")?.value;
      if (!token) throw new UnauthorizedError();
      return communityModerationService.command(actor, (await params).id, parsed.data, token);
    },
    200,
    moderationError,
  );
});
