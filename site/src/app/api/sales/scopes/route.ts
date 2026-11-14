import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../lib/resource-commerce-http";
import { sellerSalesService } from "../../../../lib/services/seller-sales-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) => {
    const params = request.nextUrl.searchParams,
      page = params.get("page") ?? "1";
    if (
      [...params.keys()].some((key) => key !== "page") ||
      params.getAll("page").length > 1 ||
      !/^[1-9][0-9]{0,3}$/u.test(page)
    )
      throw new AppError("Invalid sales query", 400, "SELLER_SALES_INVALID");
    return sellerSalesService.scopes(actor, Number(page));
  });
}
