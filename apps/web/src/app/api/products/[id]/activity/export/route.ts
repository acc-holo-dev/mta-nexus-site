import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../../lib/resource-commerce-http";
import { parseResourceActivityQuery } from "../../../../../../lib/resource-activity-query";
import { resourceActivityCsv } from "../../../../../../lib/resource-activity-csv";
import { resourceActivityService } from "../../../../../../lib/services/resource-activity-service";

export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) => {
    const days = parseResourceActivityQuery(request.nextUrl.searchParams);
    const report = await resourceActivityService.publisherReport(actor, (await params).id, days);
    return new Response(resourceActivityCsv(report), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="resource-activity-${days}days.csv"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
