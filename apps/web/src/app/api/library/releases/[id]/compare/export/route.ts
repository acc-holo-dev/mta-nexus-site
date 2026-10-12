import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../../../lib/resource-commerce-http";
import { libraryReleaseComparisonQuery } from "../../../../../../../lib/library-release-comparison-query";
import { libraryReleaseService } from "../../../../../../../lib/services/resource-release-control-service";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) => {
    const result = await libraryReleaseService.compare(
        actor,
        (await params).id,
        libraryReleaseComparisonQuery(request.nextUrl.searchParams),
      ),
      json = JSON.stringify(result, null, 2);
    if (Buffer.byteLength(json) > 512 * 1024)
      throw new AppError("Comparison export too large", 413, "LIBRARY_COMPARISON_EXPORT_TOO_LARGE");
    return new Response(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": "attachment; filename=release-comparison.json",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
