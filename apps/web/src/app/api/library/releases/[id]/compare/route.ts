import type { NextRequest } from "next/server";
import { libraryReleaseComparisonQuery } from "../../../../../../lib/library-release-comparison-query";
import { resourceCommerceRequest } from "../../../../../../lib/resource-commerce-http";
import { libraryReleaseService } from "../../../../../../lib/services/resource-release-control-service";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) =>
    libraryReleaseService.compare(
      actor,
      (await params).id,
      libraryReleaseComparisonQuery(request.nextUrl.searchParams),
    ),
  );
}
