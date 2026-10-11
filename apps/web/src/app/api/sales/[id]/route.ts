import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../lib/resource-commerce-http";
import { sellerSalesService } from "../../../../lib/services/seller-sales-service";
export function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) => {
    const params = request.nextUrl.searchParams;
    if (
      [...params.keys()].some((key) => key !== "organizationId") ||
      params.getAll("organizationId").length > 1
    )
      throw new AppError("Invalid sales query", 400, "SELLER_SALES_INVALID");
    return sellerSalesService.detail(
      actor,
      (await context.params).id,
      params.get("organizationId") ?? undefined,
    );
  });
}
