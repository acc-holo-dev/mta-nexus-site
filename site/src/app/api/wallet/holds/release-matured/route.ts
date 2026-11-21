import { AppError } from "@nexus/domain";
import { walletHoldReleaseSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import {
  walletAccountIdForUser,
  walletPaymentService,
  walletSessionRequest,
} from "../../../../../features/commerce/wallet-http";
import { readBoundedJson } from "../../../../../lib/http/bounded-json";
import { withBrowserMutation } from "../../../../../lib/http/browser-route-adapter";

/**
 * Release matured seller holds for the caller's personal seller account.
 * Dark unless NEXUS_WALLET_ENGINE=1. Org-seller release is a later slice.
 */
export const POST = withBrowserMutation(function POST(request: NextRequest) {
  return walletSessionRequest(request, true, async (actor) => {
    const expected = request.headers.get("x-nexus-actor-id");
    if (!expected) throw new AppError("Actor precondition required", 428, "ACTOR_ID_REQUIRED");
    if (expected !== actor.id) throw new AppError("Actor changed", 409, "ACTOR_CHANGED");
    const parsed = walletHoldReleaseSchema.safeParse(await readBoundedJson(request, 1024));
    if (!parsed.success) {
      throw new AppError("Invalid wallet hold release", 400, "WALLET_HOLD_INVALID");
    }
    const sellerAccountId = walletAccountIdForUser(actor.id);
    const released = await walletPaymentService.releaseMaturedHolds(
      sellerAccountId,
      parsed.data.nowIso,
    );
    return {
      accountId: sellerAccountId,
      released: released.map((hold) => ({
        id: hold.id,
        orderId: hold.orderId,
        amount: hold.amount,
        currency: hold.currency,
        status: hold.status,
        releaseLedgerBatchId: hold.releaseLedgerBatchId,
      })),
      actorId: actor.id,
    };
  });
});
