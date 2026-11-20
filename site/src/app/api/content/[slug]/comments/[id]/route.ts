import { AppError, NotFoundError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import { userPlatformApi } from "../../../../../../features/accounts/user-platform-api";
import {
  discussionEditSchema,
  discussionRemoveSchema,
} from "../../../../../../features/community/content-discussion-contract";
import { discussionMutationError } from "../../../../../../features/community/content-discussion-copy";
import {
  readBoundedJson,
  requireServerJsonContentType,
} from "../../../../../../lib/http/bounded-json";
import { withBrowserMutation } from "../../../../../../lib/http/browser-route-adapter";
import { contentService } from "../../../../../../lib/services/community/content-service";

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
