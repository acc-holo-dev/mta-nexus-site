import { AppError } from "@nexus/domain";
import { walletHeldQuerySchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import {
  walletAccountIdForUser,
  walletPaymentService,
  walletSessionRequest,
} from "../../../../features/commerce/wallet-http";

/** Seller held proceeds (ECON-002). Dark unless NEXUS_WALLET_ENGINE=1. */
export function GET(request: NextRequest) {
  return walletSessionRequest(request, false, async (actor) => {
    const parsed = walletHeldQuerySchema.safeParse({
      currency: request.nextUrl.searchParams.get("currency") ?? undefined,
    });
    if (!parsed.success) {
      throw new AppError("Invalid wallet held query", 400, "WALLET_HOLD_INVALID");
    }
    const sellerAccountId = walletAccountIdForUser(actor.id);
    const [held, holds] = await Promise.all([
      walletPaymentService.getHeldBalance(sellerAccountId, parsed.data.currency),
      walletPaymentService.listHeld(sellerAccountId, 20),
    ]);
    return {
      accountId: sellerAccountId,
      currency: parsed.data.currency,
      held,
      holds: holds
        .filter((hold) => hold.currency === parsed.data.currency)
        .map((hold) => ({
          id: hold.id,
          orderId: hold.orderId,
          amount: hold.amount,
          currency: hold.currency,
          status: hold.status,
          heldAt: hold.heldAt,
          releaseAt: hold.releaseAt,
        })),
    };
  });
}
