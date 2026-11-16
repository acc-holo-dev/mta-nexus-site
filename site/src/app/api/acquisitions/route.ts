import type { NextRequest } from "next/server";
import { parseAcquisitionHistoryQuery } from "../../../lib/resource-activity-query";
import { resourceCommerceRequest } from "../../../lib/resource-commerce-http";
import { resourceActivityService } from "../../../lib/services/resource-activity-service";

export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) => {
    const query = parseAcquisitionHistoryQuery(request.nextUrl.searchParams);
    return resourceActivityService.buyerHistory(actor, query.page, query.source);
  });
}
