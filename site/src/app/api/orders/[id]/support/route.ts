import { AppError } from "@nexus/domain";
import { orderCaseCreateSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../features/resources/resource-commerce-http";
import { readBoundedJson } from "../../../../../lib/http/bounded-json";
import { withBrowserMutation } from "../../../../../lib/http/browser-route-adapter";
import { orderCaseService } from "../../../../../lib/services/commerce/order-case-service";

type Context = { params: Promise<{ id: string }> };
export function GET(request: NextRequest, { params }: Context) {
  return resourceCommerceRequest(request, false, async (actor) =>
    orderCaseService.orderDetail((await params).id, actor),
  );
}
export const POST = withBrowserMutation(function POST(request: NextRequest, { params }: Context) {
  return resourceCommerceRequest(request, true, async (actor) => {
    const parsed = orderCaseCreateSchema.safeParse(await readBoundedJson(request, 24576));
    if (!parsed.success) throw new AppError("Invalid purchase case", 400, "ORDER_CASE_INVALID");
    return orderCaseService.create((await params).id, parsed.data, actor);
  });
});
