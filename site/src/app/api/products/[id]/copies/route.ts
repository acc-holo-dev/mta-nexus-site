import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { resourceCopiesQuery } from "../../../../../lib/resource-copy-query";
import { resourceCopyService } from "../../../../../lib/services/resource-copy-service";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) =>
    resourceCopyService.page(
      actor,
      (await params).id,
      resourceCopiesQuery(request.nextUrl.searchParams, true),
    ),
  );
}
