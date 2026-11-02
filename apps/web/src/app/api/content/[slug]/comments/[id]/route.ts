import { AppError, NotFoundError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import { readBoundedJson, requireServerJsonContentType } from "../../../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../../../lib/browser-route-adapter";
import {
  discussionEditSchema,
  discussionRemoveSchema,
} from "../../../../../../lib/content-discussion-contract";
import { discussionMutationError } from "../../../../../../lib/content-discussion-copy";
import { contentService } from "../../../../../../lib/services/content-service";
import { userPlatformApi } from "../../../../../../lib/user-platform-api";

type Context = { params: Promise<{ slug: string; id: string }> };
async function mutate(request: NextRequest, context: Context, remove: boolean) {
  return userPlatformApi(
    request,
    async (actor) => {
      const { slug, id } = await context.params;
      if (!slug || slug.length > 200 || !/^[a-z0-9-]+$/u.test(slug) || !id || id.length > 128)
        throw new NotFoundError("Comment");
      if (!(await consumeRateLimit("commentEditing", actor.id)).success)
        throw new RateLimitExceededError();
      requireServerJsonContentType(request);
      const parsed = (remove ? discussionRemoveSchema : discussionEditSchema).safeParse(
        await readBoundedJson(request, 32 * 1024),
      );
      if (!parsed.success) throw new AppError("Invalid command", 400, "COMMENT_COMMAND_INVALID");
      return contentService.manageComment({ ...parsed.data, slug, commentId: id }, actor);
    },
    200,
    discussionMutationError,
  );
}
export const PATCH = withBrowserMutation((request: NextRequest, context: Context) =>
  mutate(request, context, false),
);
export const DELETE = withBrowserMutation((request: NextRequest, context: Context) =>
  mutate(request, context, true),
);
