import type { NextRequest } from "next/server";
import { userPlatformApi } from "../../../../../../features/accounts/user-platform-api";
import {
  organizationContentFilters,
  organizationContentId,
  organizationContentRate,
} from "../../../../../../features/organizations/organization-content-api";
import { readBoundedJson, requireServerJsonContentType } from "../../../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../../../lib/browser-route-adapter";
import { organizationContentService } from "../../../../../../lib/services/organizations/organization-content-service";

type Context = { params: Promise<{ id: string }> };
export function GET(request: NextRequest, context: Context) {
  return userPlatformApi(request, async (actor) => {
    const id = organizationContentId((await context.params).id),
      filters = organizationContentFilters(request);
    await organizationContentRate(actor.id, "search");
    return organizationContentService.page(id, actor, filters);
  });
}
export const POST = withBrowserMutation((request: NextRequest, context: Context) => {
  return userPlatformApi(
    request,
    async (actor) => {
      const id = organizationContentId((await context.params).id);
      organizationContentFilters(request, true);
      requireServerJsonContentType(request);
      await organizationContentRate(actor.id, "contentCreation");
      return {
        success: true,
        content: await organizationContentService.create(
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
