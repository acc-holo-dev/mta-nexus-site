import type { NextRequest } from "next/server";
import {
  readBoundedJson,
  requireServerJsonContentType,
} from "../../../../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../../../../lib/browser-route-adapter";
import {
  organizationContentFilters,
  organizationContentId,
  organizationContentRate,
} from "../../../../../../../lib/organization-content-api";
import { organizationContentService } from "../../../../../../../lib/services/organization-content-service";
import { userPlatformApi } from "../../../../../../../lib/user-platform-api";

type Context = { params: Promise<{ id: string; contentId: string }> };
export function GET(request: NextRequest, context: Context) {
  return userPlatformApi(request, async (actor) => {
    const { id, contentId } = await context.params;
    organizationContentFilters(request, true);
    await organizationContentRate(actor.id, "search");
    return organizationContentService.get(
      organizationContentId(id),
      actor,
      organizationContentId(contentId),
    );
  });
}
function mutate(request: NextRequest, context: Context, archive: boolean) {
  return userPlatformApi(request, async (actor) => {
    const { id, contentId } = await context.params;
    organizationContentFilters(request, true);
    requireServerJsonContentType(request);
    await organizationContentRate(actor.id, "contentEditing");
    return {
      success: true,
      content: await organizationContentService.update(
        organizationContentId(id),
        actor,
        organizationContentId(contentId),
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
