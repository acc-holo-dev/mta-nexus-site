import { AppError } from "@nexus/domain";
import { orderCancellationCommandSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import { readBoundedJson } from "../../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../../lib/browser-route-adapter";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { orderOperationsService } from "../../../../../lib/services/commercial-plan-service";
export const POST = withBrowserMutation(function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return resourceCommerceRequest(request, true, async (actor) => {
    const parsed = orderCancellationCommandSchema.safeParse(await readBoundedJson(request, 4096));
    if (!parsed.success)
      throw new AppError("Invalid order operation", 400, "ORDER_OPERATION_INVALID");
    return orderOperationsService.cancel(actor, (await params).id, parsed.data);
  });
});
