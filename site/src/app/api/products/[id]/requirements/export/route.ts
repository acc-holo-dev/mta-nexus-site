import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../../lib/resource-commerce-http";
import { resourceRequirementsQuery } from "../../../../../../lib/resource-requirements-query";
import { resourceRequirementsService } from "../../../../../../lib/services/resource-requirements-service";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) => {
    const report = await resourceRequirementsService.report(
      actor.id,
      (await params).id,
      "publisher",
      resourceRequirementsQuery(request.nextUrl.searchParams, "publisher"),
    );
    const json = JSON.stringify(report, null, 2);
    if (Buffer.byteLength(json) > 512 * 1024)
      throw new AppError("Report exceeds export limit", 413, "REQUIREMENTS_EXPORT_TOO_LARGE");
    return new Response(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": "attachment; filename=resource-requirements.json",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
