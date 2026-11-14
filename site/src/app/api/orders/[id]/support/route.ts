import { AppError } from "@nexus/domain";
import { orderCaseCreateSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import { readBoundedJson } from "../../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../../lib/browser-route-adapter";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { orderCaseService } from "../../../../../lib/services/order-case-service";

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
