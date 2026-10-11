import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../../../lib/resource-commerce-http";
import { resourceCopiesQuery } from "../../../../../../../lib/resource-copy-query";
import { resourceCopyService } from "../../../../../../../lib/services/resource-copy-service";
export function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; receiptId: string }> },
) {
  return resourceCommerceRequest(request, false, async (actor) => {
    resourceCopiesQuery(request.nextUrl.searchParams);
    const { id, receiptId } = await params;
    const detail = await resourceCopyService.detail(actor, id, receiptId);
    const body = JSON.stringify({ format: "nexus-resource-copy-v1", ...detail }, null, 2);
    if (new TextEncoder().encode(body).byteLength > 80 * 1024)
      throw new AppError("Copy export too large", 409, "RESOURCE_COPY_EXPORT_LIMIT");
    return new Response(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="resource-copy-${detail.receipt.id}.json"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
