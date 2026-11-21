import { AppError, UnauthorizedError } from "@nexus/domain";
import { walletPayOrderSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import {
  walletPaymentService,
  walletSessionRequest,
} from "../../../../../features/commerce/wallet-http";
import { withBrowserMutation } from "../../../../../lib/http/browser-route-adapter";

export const POST = withBrowserMutation(function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return walletSessionRequest(request, true, async (actor) => {
    const token = request.cookies.get("nexus_session")?.value;
    if (!token) throw new UnauthorizedError();
    const expected = request.headers.get("x-nexus-actor-id");
    if (!expected) throw new AppError("Actor precondition required", 428, "ACTOR_ID_REQUIRED");
    if (expected !== actor.id) throw new AppError("Actor changed", 409, "ACTOR_CHANGED");
    const orderId = (await params).id;
    const parsed = walletPayOrderSchema.safeParse({ orderId });
    if (!parsed.success)
      throw new AppError("Invalid wallet settlement", 400, "WALLET_SETTLE_INVALID");
    const settled = await walletPaymentService.settleOrderFromWallet({
      user: actor,
      currentToken: token,
      orderId: parsed.data.orderId,
    });
    return {
      orderId: settled.orderId,
      paymentId: settled.paymentId,
      ledgerBatchId: settled.ledgerBatchId,
      status: settled.status,
      totalAmount: settled.totalAmount,
      currency: settled.currency,
      alreadySettled: settled.alreadySettled,
      actorId: actor.id,
    };
  });
});
