import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { resourceDeliveriesQuery } from "../../../../../lib/resource-deliveries-query";
import { resourceDeliveriesCsv } from "../../../../../lib/resource-deliveries-csv";
import { resourceDeliveriesService } from "../../../../../lib/services/resource-deliveries-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, async (actor) => {
    const result = await resourceDeliveriesService.page(
      actor,
      resourceDeliveriesQuery(request.nextUrl.searchParams),
    );
    return new Response(resourceDeliveriesCsv(result.items), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="downloads-page-${result.page}.csv"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
