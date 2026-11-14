import type { NextRequest } from "next/server";
import { commercialCatalogQuery } from "../../../../lib/commercial-plan-query";
import { commercialPublicRequest } from "../../../../lib/commercial-public-http";
import { commercialPlanService } from "../../../../lib/services/commercial-plan-service";
export function GET(request: NextRequest) {
  return commercialPublicRequest(request, async () => {
    const query = commercialCatalogQuery(request.nextUrl.searchParams);
    return commercialPlanService.catalog(query.scope, query.page);
  });
}
