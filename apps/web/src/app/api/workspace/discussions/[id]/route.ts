import type { NextRequest } from "next/server";
import { z } from "zod";
import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { userPlatformApi } from "../../../../../lib/user-platform-api";
import { discussionWorkspaceService } from "../../../../../lib/services/discussion-workspace-service";
import { ownDiscussionError } from "../../../../../lib/discussion-workspace-copy";
import { discussionEditSchema } from "../../../../../lib/content-discussion-contract";
import { readBoundedJson, requireServerJsonContentType } from "../../../../../lib/bounded-json";
type Context = { params: Promise<{ id: string }> };
const removal = z.object({ expectedRevision: z.string().regex(/^[a-f0-9]{64}$/u) }).strict();
function noQuery(request: NextRequest) {
  if (request.nextUrl.searchParams.size)
    throw new AppError("Unexpected filters", 400, "VALIDATION_ERROR");
}
export async function GET(request: NextRequest, context: Context) {
  return userPlatformApi(
    request,
    async (actor) => {
      noQuery(request);
      if (!(await consumeRateLimit("search", actor.id)).success) throw new RateLimitExceededError();
      return discussionWorkspaceService.own(actor, (await context.params).id);
    },
    200,
    ownDiscussionError,
  );
}
async function mutate(request: NextRequest, context: Context, remove: boolean) {
  return userPlatformApi(
    request,
    async (actor) => {
      noQuery(request);
      if (!(await consumeRateLimit("commentEditing", actor.id)).success)
        throw new RateLimitExceededError();
      requireServerJsonContentType(request);
      const parsed = (remove ? removal : discussionEditSchema).safeParse(
        await readBoundedJson(request, 32 * 1024),
      );
      if (!parsed.success)
        throw new AppError("Invalid comment action", 400, "COMMENT_COMMAND_INVALID");
      return discussionWorkspaceService.mutate(actor, (await context.params).id, parsed.data);
    },
    200,
    ownDiscussionError,
  );
}
export const PATCH = (request: NextRequest, context: Context) => mutate(request, context, false);
export const DELETE = (request: NextRequest, context: Context) => mutate(request, context, true);
