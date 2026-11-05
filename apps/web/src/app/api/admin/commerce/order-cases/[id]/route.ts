import { AppError, UnauthorizedError } from "@nexus/domain";
import { orderCaseReviewSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import { readBoundedJson } from "../../../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../../../lib/browser-route-adapter";
import { orderCaseQuery } from "../../../../../../lib/order-case-query";
import { resourceCommerceRequest } from "../../../../../../lib/resource-commerce-http";
import { orderCaseService } from "../../../../../../lib/services/order-case-service";

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
export const POST = withBrowserMutation(function POST(request: NextRequest, { params }: Context) {
  return resourceCommerceRequest(request, true, async (actor) => {
    const token = request.cookies.get("nexus_session")?.value;
    if (!token) throw new UnauthorizedError();
    const expected = request.headers.get("x-nexus-actor-id");
    if (!expected) throw new AppError("Actor precondition required", 428, "ACTOR_ID_REQUIRED");
    if (expected !== actor.id) throw new AppError("Account changed", 409, "ACTOR_CHANGED");
    const parsed = orderCaseReviewSchema.safeParse(await readBoundedJson(request, 16384));
    if (!parsed.success)
      throw new AppError("Invalid purchase case review", 400, "ORDER_CASE_REVIEW_INVALID");
    return {
      ...(await orderCaseService.review((await params).id, parsed.data, actor, token)),
      actorId: actor.id,
    };
  });
});
