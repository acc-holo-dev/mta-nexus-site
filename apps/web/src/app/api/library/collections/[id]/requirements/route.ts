import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../../lib/resource-commerce-http";
import { resourceRequirementsQuery } from "../../../../../../lib/resource-requirements-query";
import { resourceRequirementsService } from "../../../../../../lib/services/resource-requirements-service";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) => {
    const result = await resourceRequirementsService.collectionReport(
      actor.id,
      (await params).id,
      resourceRequirementsQuery(request.nextUrl.searchParams, "library"),
    );
    return result;
  });
}
