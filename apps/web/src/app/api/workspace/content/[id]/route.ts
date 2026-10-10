import type { NextRequest } from "next/server";
import { consumeRateLimit } from "@nexus/security";
import { NotFoundError, RateLimitExceededError } from "@nexus/domain";
import { userPlatformApi } from "../../../../../lib/user-platform-api";
import { authorContentService } from "../../../../../lib/services/author-content-service";
import { readBoundedJson, requireServerJsonContentType } from "../../../../../lib/bounded-json";
type Context = { params: Promise<{ id: string }> };
async function target(context: Context) {
  const { id } = await context.params;
  if (!id || id.length > 128) throw new NotFoundError("Content");
  return id;
}
export function GET(request: NextRequest, context: Context) {
  return userPlatformApi(request, async (user) => ({
    content: await authorContentService.get(await target(context), user),
  }));
}
function mutate(request: NextRequest, context: Context, archive: boolean) {
  return userPlatformApi(request, async (user) => {
    if (!(await consumeRateLimit("contentEditing", user.id)).success)
      throw new RateLimitExceededError();
    requireServerJsonContentType(request);
    const input = await readBoundedJson(request, 128 * 1024);
    return {
      success: true,
      content: await authorContentService.update(await target(context), input, user, archive),
    };
  });
}
export const PATCH = (request: NextRequest, context: Context) => mutate(request, context, false);
export const DELETE = (request: NextRequest, context: Context) => mutate(request, context, true);
