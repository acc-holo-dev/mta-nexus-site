import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../../features/resources/resource-commerce-http";
import { resourceRequirementsQuery } from "../../../../../../features/resources/resource-requirements-query";
import { resourceRequirementsService } from "../../../../../../lib/services/resources/resource-requirements-service";
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
