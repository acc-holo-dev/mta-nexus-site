import type { NextRequest } from "next/server";
import { NotFoundError } from "@nexus/domain";
import { resourceCommerceRequest } from "../../../../lib/resource-commerce-http";
import { commerceService } from "../../../../lib/services/commerce-service";
import { parseHistoryPage } from "../../../../lib/commerce-history-format";

export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) => {
    const { id } = await params;
    const result = await commerceService.getBuyerOrderDetails(
      actor,
      id,
      parseHistoryPage(request.nextUrl.searchParams.get("page") ?? undefined),
    );
    if (!result) throw new NotFoundError("Order");
    return result;
  });
}
