import { AppError, ForbiddenError } from "@nexus/domain";
import { walletIntentExpireBatchSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import {
  walletPaymentService,
  walletSessionRequest,
} from "../../../../../../features/commerce/wallet-http";
import { readBoundedJson } from "../../../../../../lib/http/bounded-json";
import { withBrowserMutation } from "../../../../../../lib/http/browser-route-adapter";

/**
 * Admin batch: cancel stale unpaid pending orders (no payments, no ledger).
 * Dark unless NEXUS_WALLET_ENGINE=1. Default age 7d. Not a refund / not a cron.
 */
export const POST = withBrowserMutation(function POST(request: NextRequest) {
  return walletSessionRequest(request, true, async (actor) => {
    if (actor.role !== "admin") throw new ForbiddenError();
    const expected = request.headers.get("x-nexus-actor-id");
    if (!expected) throw new AppError("Actor precondition required", 428, "ACTOR_ID_REQUIRED");
    if (expected !== actor.id) throw new AppError("Actor changed", 409, "ACTOR_CHANGED");
    const parsed = walletIntentExpireBatchSchema.safeParse(await readBoundedJson(request, 1024));
    if (!parsed.success) {
      throw new AppError("Invalid wallet order expiry batch", 400, "WALLET_INTENT_STALE_INVALID");
    }
    const expired = await walletPaymentService.expireStalePendingOrders({
      actorId: actor.id,
      nowIso: parsed.data.nowIso,
      maxAgeMs: parsed.data.maxAgeMs,
      limit: parsed.data.limit,
    });
    return {
      expired: expired.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        buyerId: order.buyerId,
        status: order.status,
        totalAmount: order.totalAmount,
        currency: order.currency,
        createdAt: order.createdAt.toISOString(),
        cancelledAt: order.cancelledAt.toISOString(),
      })),
      count: expired.length,
      actorId: actor.id,
    };
  });
});
