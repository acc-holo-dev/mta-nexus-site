import type { NextRequest } from "next/server";
import { sellerSalesDetailQuery } from "../../../../features/commerce/seller-sales-query";
import { resourceCommerceRequest } from "../../../../features/resources/resource-commerce-http";
import { sellerSalesService } from "../../../../lib/services/commerce/seller-sales-service";
export function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) => {
    const { organizationId, attribution } = sellerSalesDetailQuery(request.nextUrl.searchParams);
    const id = (await context.params).id;
    return attribution
      ? sellerSalesService.detail(actor, id, organizationId, attribution)
      : sellerSalesService.detail(actor, id, organizationId);
  });
}
