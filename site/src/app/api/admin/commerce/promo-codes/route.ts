import { AppError, ForbiddenError } from "@nexus/domain";
import { walletPromoCreateSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import {
  walletPaymentService,
  walletSessionRequest,
} from "../../../../../features/commerce/wallet-http";
import { readBoundedJson } from "../../../../../lib/http/bounded-json";
import { withBrowserMutation } from "../../../../../lib/http/browser-route-adapter";

/**
 * Admin creates a platform-funded promo code.
 * Dark unless NEXUS_WALLET_ENGINE=1. Not a payment-provider coupon.
 */
export const POST = withBrowserMutation(function POST(request: NextRequest) {
  return walletSessionRequest(request, true, async (actor) => {
    if (actor.role !== "admin") throw new ForbiddenError();
    const expected = request.headers.get("x-nexus-actor-id");
    if (!expected) throw new AppError("Actor precondition required", 428, "ACTOR_ID_REQUIRED");
    if (expected !== actor.id) throw new AppError("Actor changed", 409, "ACTOR_CHANGED");
    const parsed = walletPromoCreateSchema.safeParse(await readBoundedJson(request, 2048));
    if (!parsed.success) throw new AppError("Promo code is invalid", 400, "PROMO_INVALID");
    const created = await walletPaymentService.createPromoCode({
      actor,
      code: parsed.data.code,
      kind: parsed.data.kind,
      ...(parsed.data.percent !== undefined ? { percent: parsed.data.percent } : {}),
      ...(parsed.data.amount !== undefined ? { amount: parsed.data.amount } : {}),
      ...(parsed.data.currency ? { currency: parsed.data.currency } : {}),
      ...(parsed.data.maxRedemptions !== undefined
        ? { maxRedemptions: parsed.data.maxRedemptions }
        : {}),
    });
    return { ...created, actorId: actor.id };
  });
});
