import type { NextRequest } from "next/server";
import { orderTermsPageQuery } from "../../../../../lib/order-terms-query";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { orderTermsService } from "../../../../../lib/services/order-terms-service";
export function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) => {
    return orderTermsService.report(
      actor,
      (await context.params).id,
      "buyer",
      orderTermsPageQuery(request.nextUrl.searchParams),
    );
  });
}
