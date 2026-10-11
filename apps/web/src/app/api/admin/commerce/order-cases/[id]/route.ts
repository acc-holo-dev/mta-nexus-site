import type { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
import { orderCaseReviewSchema } from "@nexus/validation";
import { readBoundedJson } from "../../../../../../lib/bounded-json";
import { resourceCommerceRequest } from "../../../../../../lib/resource-commerce-http";
import { orderCaseService } from "../../../../../../lib/services/order-case-service";
import { orderCaseQuery } from "../../../../../../lib/order-case-query";
type Context = { params: Promise<{ id: string }> };
export function GET(request: NextRequest, { params }: Context) {
  return resourceCommerceRequest(request, false, async (actor) =>
    orderCaseService.detail(
      (await params).id,
      actor,
      true,
      orderCaseQuery(request.nextUrl.searchParams).page,
    ),
  );
}
export function POST(request: NextRequest, { params }: Context) {
  return resourceCommerceRequest(request, true, async (actor) => {
    const parsed = orderCaseReviewSchema.safeParse(await readBoundedJson(request, 16384));
    if (!parsed.success)
      throw new AppError("Invalid purchase case review", 400, "ORDER_CASE_REVIEW_INVALID");
    return orderCaseService.review((await params).id, parsed.data, actor);
  });
}
