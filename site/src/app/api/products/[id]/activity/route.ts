import type { NextRequest } from "next/server";
import { parseResourceActivityQuery } from "../../../../../lib/resource-activity-query";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { resourceActivityService } from "../../../../../lib/services/resource-activity-service";

export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) => {
    const days = parseResourceActivityQuery(request.nextUrl.searchParams);
    return resourceActivityService.publisherReport(actor, (await params).id, days);
  });
}
