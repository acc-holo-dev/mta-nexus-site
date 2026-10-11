import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../lib/resource-commerce-http";
import { orderCaseService } from "../../../lib/services/order-case-service";
import { orderCaseQuery } from "../../../lib/order-case-query";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) => {
    const query = orderCaseQuery(request.nextUrl.searchParams, true);
    return orderCaseService.page(actor, false, query.page, query);
  });
}
