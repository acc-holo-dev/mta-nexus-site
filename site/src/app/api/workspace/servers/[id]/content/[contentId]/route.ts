import type { NextRequest } from "next/server";
import { userPlatformApi } from "../../../../../../../features/accounts/user-platform-api";
import {
  serverContentFilters,
  serverContentId,
  serverContentRate,
} from "../../../../../../../features/servers/server-content-api";
import {
  readBoundedJson,
  requireServerJsonContentType,
} from "../../../../../../../lib/http/bounded-json";
import { withBrowserMutation } from "../../../../../../../lib/http/browser-route-adapter";
import { serverContentService } from "../../../../../../../lib/services/servers/server-content-service";

type Context = { params: Promise<{ id: string; contentId: string }> };
export function GET(request: NextRequest, context: Context) {
  return userPlatformApi(request, async (actor) => {
    const { id, contentId } = await context.params;
    serverContentFilters(request, true);
    await serverContentRate(actor.id, "search");
    return serverContentService.get(serverContentId(id), actor, serverContentId(contentId));
  });
}
function mutate(request: NextRequest, context: Context, archive: boolean) {
  return userPlatformApi(request, async (actor) => {
    const { id, contentId } = await context.params;
    serverContentFilters(request, true);
    requireServerJsonContentType(request);
    await serverContentRate(actor.id, "contentEditing");
    return {
      success: true,
      content: await serverContentService.update(
        serverContentId(id),
        actor,
        serverContentId(contentId),
        await readBoundedJson(request, 128 * 1024),
        archive,
      ),
    };
  });
}
export const PATCH = withBrowserMutation((request: NextRequest, context: Context) =>
  mutate(request, context, false),
);
export const DELETE = withBrowserMutation((request: NextRequest, context: Context) =>
  mutate(request, context, true),
);
