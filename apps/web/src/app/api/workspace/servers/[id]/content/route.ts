import type { NextRequest } from "next/server";
import { userPlatformApi } from "../../../../../../lib/user-platform-api";
import { serverContentService } from "../../../../../../lib/services/server-content-service";
import {
  serverContentId,
  serverContentFilters,
  serverContentRate,
} from "../../../../../../lib/server-content-api";
import { readBoundedJson, requireServerJsonContentType } from "../../../../../../lib/bounded-json";
type Context = { params: Promise<{ id: string }> };
export function GET(request: NextRequest, context: Context) {
  return userPlatformApi(request, async (actor) => {
    const id = serverContentId((await context.params).id),
      filters = serverContentFilters(request);
    await serverContentRate(actor.id, "search");
    return serverContentService.page(id, actor, filters);
  });
}
export function POST(request: NextRequest, context: Context) {
  return userPlatformApi(
    request,
    async (actor) => {
      const id = serverContentId((await context.params).id);
      serverContentFilters(request, true);
      requireServerJsonContentType(request);
      await serverContentRate(actor.id, "contentCreation");
      return {
        success: true,
        content: await serverContentService.create(
          id,
          actor,
          await readBoundedJson(request, 128 * 1024),
        ),
      };
    },
    201,
  );
}
