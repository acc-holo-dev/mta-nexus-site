import type { NextRequest } from "next/server";
import { resourceCartReceiptId } from "../../../../../../features/resources/resource-cart-receipts-query";
import { resourceCommerceRequest } from "../../../../../../features/resources/resource-commerce-http";
import { resourceCartReceiptsService } from "../../../../../../lib/services/commerce/resource-cart-receipts-service";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) =>
    resourceCartReceiptsService.detail(actor, resourceCartReceiptId((await params).id)),
  );
}
