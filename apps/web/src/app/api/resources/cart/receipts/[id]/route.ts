import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../../lib/resource-commerce-http";
import { resourceCartReceiptsService } from "../../../../../../lib/services/resource-cart-receipts-service";
import { resourceCartReceiptId } from "../../../../../../lib/resource-cart-receipts-query";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) =>
    resourceCartReceiptsService.detail(actor, resourceCartReceiptId((await params).id)),
  );
}
