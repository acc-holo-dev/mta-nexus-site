import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../../features/resources/resource-commerce-http";
import { resourceCopiesQuery } from "../../../../../../features/resources/resource-copy-query";
import { resourceCopyService } from "../../../../../../lib/services/resources/resource-copy-service";
export function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; receiptId: string }> },
) {
  return resourceCommerceRequest(request, false, async (actor) => {
    resourceCopiesQuery(request.nextUrl.searchParams);
    const { id, receiptId } = await params;
    return resourceCopyService.detail(actor, id, receiptId);
  });
}
