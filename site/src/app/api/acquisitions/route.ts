import type { NextRequest } from "next/server";
import { parseAcquisitionHistoryQuery } from "../../../features/resources/resource-activity-query";
import { resourceCommerceRequest } from "../../../features/resources/resource-commerce-http";
import { resourceActivityService } from "../../../lib/services/resource-activity-service";

export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) => {
    const query = parseAcquisitionHistoryQuery(request.nextUrl.searchParams);
    return resourceActivityService.buyerHistory(actor, query.page, query.source);
  });
}
