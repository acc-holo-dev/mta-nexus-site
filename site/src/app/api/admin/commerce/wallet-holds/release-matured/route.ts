import { AppError, ForbiddenError } from "@nexus/domain";
import { walletHoldReleaseBatchSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import {
  walletPaymentService,
  walletSessionRequest,
} from "../../../../../../features/commerce/wallet-http";
import { readBoundedJson } from "../../../../../../lib/http/bounded-json";
import { withBrowserMutation } from "../../../../../../lib/http/browser-route-adapter";

/**
 * Admin batch release of matured ECON-002 seller holds across accounts.
 * Dark unless NEXUS_WALLET_ENGINE=1. Sellers still use /api/wallet/holds/release-matured.
 */
export const POST = withBrowserMutation(function POST(request: NextRequest) {
  return walletSessionRequest(request, true, async (actor) => {
    if (actor.role !== "admin") throw new ForbiddenError();
    const expected = request.headers.get("x-nexus-actor-id");
    if (!expected) throw new AppError("Actor precondition required", 428, "ACTOR_ID_REQUIRED");
    if (expected !== actor.id) throw new AppError("Actor changed", 409, "ACTOR_CHANGED");
    const parsed = walletHoldReleaseBatchSchema.safeParse(await readBoundedJson(request, 1024));
    if (!parsed.success) {
      throw new AppError("Invalid wallet hold batch release", 400, "WALLET_HOLD_INVALID");
    }
    const released = await walletPaymentService.releaseMaturedHoldsBatch({
      nowIso: parsed.data.nowIso,
      limit: parsed.data.limit,
    });
    return {
      released: released.map((hold) => ({
        id: hold.id,
        orderId: hold.orderId,
        sellerAccountId: hold.sellerAccountId,
        amount: hold.amount,
        currency: hold.currency,
        status: hold.status,
        releaseLedgerBatchId: hold.releaseLedgerBatchId,
      })),
      count: released.length,
      actorId: actor.id,
    };
  });
});
