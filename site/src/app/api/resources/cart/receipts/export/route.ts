import type { NextRequest } from "next/server";
import { resourceCartReceiptsCsv } from "../../../../../../features/resources/resource-cart-receipts-csv";
import { resourceCartReceiptQuery } from "../../../../../../features/resources/resource-cart-receipts-query";
import { resourceCommerceRequest } from "../../../../../../features/resources/resource-commerce-http";
import { resourceCartReceiptsService } from "../../../../../../lib/services/resource-cart-receipts-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, async (actor) => {
    const result = await resourceCartReceiptsService.page(
      actor,
      resourceCartReceiptQuery(request.nextUrl.searchParams),
    );
    return new Response(resourceCartReceiptsCsv(result.items), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="acquisition-receipts-page-${result.page}.csv"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
