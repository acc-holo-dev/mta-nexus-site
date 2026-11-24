import { AppError } from "@nexus/domain";
import { walletPromoQuoteSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import {
  walletPaymentService,
  walletSessionRequest,
} from "../../../../../features/commerce/wallet-http";
import { readBoundedJson } from "../../../../../lib/http/bounded-json";
import { withBrowserMutation } from "../../../../../lib/http/browser-route-adapter";

/**
 * Preview a platform promo against the published paid catalog.
 * Does not create an order or reserve the code.
 */
export const POST = withBrowserMutation(function POST(request: NextRequest) {
  return walletSessionRequest(request, true, async (actor) => {
    const expected = request.headers.get("x-nexus-actor-id");
    if (!expected) throw new AppError("Actor precondition required", 428, "ACTOR_ID_REQUIRED");
    if (expected !== actor.id) throw new AppError("Actor changed", 409, "ACTOR_CHANGED");
    const parsed = walletPromoQuoteSchema.safeParse(await readBoundedJson(request, 4096));
    if (!parsed.success) throw new AppError("Promo code is invalid", 400, "PROMO_INVALID");
    const quote = await walletPaymentService.quoteWalletPromo({
      user: actor,
      productIds: parsed.data.productIds,
      ...(parsed.data.buildId ? { buildId: parsed.data.buildId } : {}),
      promoCode: parsed.data.promoCode,
    });
    return { ...quote, actorId: actor.id };
  });
});
