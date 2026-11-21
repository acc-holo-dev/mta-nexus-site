import { AppError, ForbiddenError } from "@nexus/domain";
import { walletOrderRefundSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import {
  walletPaymentService,
  walletSessionRequest,
} from "../../../../../../../features/commerce/wallet-http";
import { withBrowserMutation } from "../../../../../../../lib/http/browser-route-adapter";

/**
 * Staff full wallet order refund: reverse ledger, cancel/clawback holds,
 * expire settle entitlements. Dark unless NEXUS_WALLET_ENGINE=1. Admin only.
 * Live PSP refund adapters stay off.
 */
export const POST = withBrowserMutation(function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  return walletSessionRequest(request, true, async (actor) => {
    if (actor.role !== "admin") throw new ForbiddenError();
    const expected = request.headers.get("x-nexus-actor-id");
    if (!expected) throw new AppError("Actor precondition required", 428, "ACTOR_ID_REQUIRED");
    if (expected !== actor.id) throw new AppError("Actor changed", 409, "ACTOR_CHANGED");
    const orderId = (await params).orderId;
    const parsed = walletOrderRefundSchema.safeParse({ orderId });
    if (!parsed.success) {
      throw new AppError("Invalid wallet refund", 400, "WALLET_REFUND_INVALID");
    }
    const result = await walletPaymentService.refundWalletOrder({
      actor,
      orderId: parsed.data.orderId,
    });
    return {
      orderId: result.orderId,
      paymentId: result.paymentId,
      ledgerBatchId: result.ledgerBatchId,
      status: result.status,
      totalAmount: result.totalAmount,
      currency: result.currency,
      alreadyRefunded: result.alreadyRefunded,
      cancelledHoldIds: result.cancelledHoldIds,
      clawedBackHoldIds: result.clawedBackHoldIds,
      expiredEntitlementIds: result.expiredEntitlementIds,
      actorId: actor.id,
    };
  });
});
