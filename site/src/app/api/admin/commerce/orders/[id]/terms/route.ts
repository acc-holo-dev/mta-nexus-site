import type { NextRequest } from "next/server";
import { orderTermsPageQuery } from "../../../../../../../features/commerce/order-terms-query";
import { resourceCommerceRequest } from "../../../../../../../features/resources/resource-commerce-http";
import { orderTermsService } from "../../../../../../../lib/services/commerce/order-terms-service";
export function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) => {
    return orderTermsService.report(
      actor,
      (await context.params).id,
      "admin",
      orderTermsPageQuery(request.nextUrl.searchParams),
    );
  });
}
