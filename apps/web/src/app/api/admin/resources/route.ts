import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../lib/resource-commerce-http";
import { resourceModerationQuery } from "../../../../lib/resource-release-control-query";
import { resourceModerationService } from "../../../../lib/services/resource-release-control-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) => {
    const query = resourceModerationQuery(request.nextUrl.searchParams);
    return resourceModerationService.page(actor, query.page, query.status, query.query);
  });
}
