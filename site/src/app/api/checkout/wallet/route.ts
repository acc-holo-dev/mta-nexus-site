import { AppError, UnauthorizedError } from "@nexus/domain";
import { walletCheckoutSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import {
  walletPaymentService,
  walletSessionRequest,
} from "../../../../features/commerce/wallet-http";
import { readBoundedJson } from "../../../../lib/http/bounded-json";
import { withBrowserMutation } from "../../../../lib/http/browser-route-adapter";

/**
 * Wallet create+settle checkout. Card `/api/checkout` stays CHECKOUT_DISABLED.
 * Dark unless NEXUS_WALLET_ENGINE=1.
 */
export const POST = withBrowserMutation(function POST(request: NextRequest) {
  return walletSessionRequest(request, true, async (actor) => {
    const token = request.cookies.get("nexus_session")?.value;
    if (!token) throw new UnauthorizedError();
    const expected = request.headers.get("x-nexus-actor-id");
    if (!expected) throw new AppError("Actor precondition required", 428, "ACTOR_ID_REQUIRED");
    if (expected !== actor.id) throw new AppError("Actor changed", 409, "ACTOR_CHANGED");
    const parsed = walletCheckoutSchema.safeParse(await readBoundedJson(request, 4096));
    if (!parsed.success) {
      throw new AppError("Invalid wallet checkout", 400, "WALLET_CHECKOUT_INVALID");
    }
    const settled = await walletPaymentService.checkoutAndSettleFromWallet({
      user: actor,
      currentToken: token,
      productIds: parsed.data.productIds,
      ...(parsed.data.buildId ? { buildId: parsed.data.buildId } : {}),
      ...(parsed.data.promoCode ? { promoCode: parsed.data.promoCode } : {}),
    });
    return {
      orderId: settled.orderId,
      orderNumber: settled.orderNumber,
      paymentId: settled.paymentId,
      ledgerBatchId: settled.ledgerBatchId,
      status: settled.status,
      totalAmount: settled.totalAmount,
      currency: settled.currency,
      listAmount: settled.listAmount,
      discountAmount: settled.discountAmount,
      promoCode: settled.promoCode,
      alreadySettled: settled.alreadySettled,
      purchasedBuilds: settled.purchasedBuilds,
      actorId: actor.id,
    };
  });
});
