import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../lib/resource-commerce-http";
import { sellerSalesDetailQuery } from "../../../../lib/seller-sales-query";
import { sellerSalesService } from "../../../../lib/services/seller-sales-service";
export function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) => {
    const { organizationId, attribution } = sellerSalesDetailQuery(request.nextUrl.searchParams);
    const id = (await context.params).id;
    return attribution
      ? sellerSalesService.detail(actor, id, organizationId, attribution)
      : sellerSalesService.detail(actor, id, organizationId);
  });
}
