import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../../lib/resource-commerce-http";
import { resourceRequirementsQuery } from "../../../../../../lib/resource-requirements-query";
import { resourceRequirementsService } from "../../../../../../lib/services/resource-requirements-service";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) => {
    const report = await resourceRequirementsService.report(
      actor.id,
      (await params).id,
      "moderator",
      resourceRequirementsQuery(request.nextUrl.searchParams, "moderator"),
    );
    return report;
  });
}
