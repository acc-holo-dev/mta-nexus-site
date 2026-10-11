import type { NextRequest } from "next/server";
import { userPlatformApi } from "../../../../../../lib/user-platform-api";
import { organizationContentService } from "../../../../../../lib/services/organization-content-service";
import {
  organizationContentId,
  organizationContentFilters,
  organizationContentRate,
} from "../../../../../../lib/organization-content-api";
import { readBoundedJson, requireServerJsonContentType } from "../../../../../../lib/bounded-json";
type Context = { params: Promise<{ id: string }> };
export function GET(request: NextRequest, context: Context) {
  return userPlatformApi(request, async (actor) => {
    const id = organizationContentId((await context.params).id),
      filters = organizationContentFilters(request);
    await organizationContentRate(actor.id, "search");
    return organizationContentService.page(id, actor, filters);
  });
}
export function POST(request: NextRequest, context: Context) {
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
        ),
      };
    },
    201,
  );
}
