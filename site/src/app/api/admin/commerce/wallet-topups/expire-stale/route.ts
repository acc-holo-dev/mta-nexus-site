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
 * Admin batch: mark stale awaiting/created top-ups as failed (no ledger).
 * Dark unless NEXUS_WALLET_ENGINE=1. Default age 7d.
 */
export const POST = withBrowserMutation(function POST(request: NextRequest) {
  return walletSessionRequest(request, true, async (actor) => {
    if (actor.role !== "admin") throw new ForbiddenError();
    const expected = request.headers.get("x-nexus-actor-id");
    if (!expected) throw new AppError("Actor precondition required", 428, "ACTOR_ID_REQUIRED");
    if (expected !== actor.id) throw new AppError("Actor changed", 409, "ACTOR_CHANGED");
    const parsed = walletIntentExpireBatchSchema.safeParse(await readBoundedJson(request, 1024));
    if (!parsed.success) {
      throw new AppError("Invalid wallet top-up expiry batch", 400, "WALLET_INTENT_STALE_INVALID");
    }
    const expired = await walletPaymentService.expireStaleTopUps({
      nowIso: parsed.data.nowIso,
      maxAgeMs: parsed.data.maxAgeMs,
      limit: parsed.data.limit,
    });
    return {
      expired: expired.map((intent) => ({
        id: intent.id,
        status: intent.status,
        amount: intent.amount,
        currency: intent.currency,
        accountId: intent.accountId,
        providerId: intent.providerId,
        createdAt: intent.createdAt,
      })),
      count: expired.length,
      actorId: actor.id,
    };
  });
});
