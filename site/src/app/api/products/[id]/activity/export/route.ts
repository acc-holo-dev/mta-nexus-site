import type { NextRequest } from "next/server";
import { resourceActivityCsv } from "../../../../../../features/resources/resource-activity-csv";
import { parseResourceActivityQuery } from "../../../../../../features/resources/resource-activity-query";
import { resourceCommerceRequest } from "../../../../../../features/resources/resource-commerce-http";
import { isWalletEngineEnabled } from "../../../../../../lib/services/commerce/wallet-payment-service";
import { resourceActivityService } from "../../../../../../lib/services/resources/resource-activity-service";

export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) => {
    const days = parseResourceActivityQuery(request.nextUrl.searchParams);
    const report = await resourceActivityService.publisherReport(actor, (await params).id, days);
    return new Response(resourceActivityCsv(report, { walletEnabled: isWalletEngineEnabled() }), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="resource-activity-${days}days.csv"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
