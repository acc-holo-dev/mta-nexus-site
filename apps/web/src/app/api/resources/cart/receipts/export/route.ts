import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../../lib/resource-commerce-http";
import { resourceCartReceiptQuery } from "../../../../../../lib/resource-cart-receipts-query";
import { resourceCartReceiptsCsv } from "../../../../../../lib/resource-cart-receipts-csv";
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
