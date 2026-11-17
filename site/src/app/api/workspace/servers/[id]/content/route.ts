import type { NextRequest } from "next/server";
import { userPlatformApi } from "../../../../../../features/accounts/user-platform-api";
import {
  serverContentFilters,
  serverContentId,
  serverContentRate,
} from "../../../../../../features/servers/server-content-api";
import { readBoundedJson, requireServerJsonContentType } from "../../../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../../../lib/browser-route-adapter";
import { serverContentService } from "../../../../../../lib/services/servers/server-content-service";

type Context = { params: Promise<{ id: string }> };
export function GET(request: NextRequest, context: Context) {
  return userPlatformApi(request, async (actor) => {
    const id = serverContentId((await context.params).id),
      filters = serverContentFilters(request);
    await serverContentRate(actor.id, "search");
    return serverContentService.page(id, actor, filters);
  });
}
export const POST = withBrowserMutation((request: NextRequest, context: Context) => {
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
          request.cookies.get("nexus_session")?.value ?? "",
        ),
      };
    },
    201,
  );
});
