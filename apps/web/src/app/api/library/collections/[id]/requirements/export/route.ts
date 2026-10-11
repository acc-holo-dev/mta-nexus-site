import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../../../lib/resource-commerce-http";
import { resourceRequirementsQuery } from "../../../../../../../lib/resource-requirements-query";
import { resourceRequirementsService } from "../../../../../../../lib/services/resource-requirements-service";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) => {
    const result = await resourceRequirementsService.collectionReport(
      actor.id,
      (await params).id,
      resourceRequirementsQuery(request.nextUrl.searchParams, "library"),
    );
    const json = JSON.stringify(result, null, 2);
    if (Buffer.byteLength(json) > 512 * 1024)
      throw new AppError("Report exceeds export limit", 413, "REQUIREMENTS_EXPORT_TOO_LARGE");
    return new Response(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": "attachment; filename=collection-requirements.json",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
