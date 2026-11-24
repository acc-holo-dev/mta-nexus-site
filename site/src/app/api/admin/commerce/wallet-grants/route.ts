import { AppError, ForbiddenError } from "@nexus/domain";
import { walletStaffGrantSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import {
  walletPaymentService,
  walletSessionRequest,
} from "../../../../../features/commerce/wallet-http";
import { readBoundedJson } from "../../../../../lib/http/bounded-json";
import { withBrowserMutation } from "../../../../../lib/http/browser-route-adapter";

/**
 * Admin credit of available site-wallet balance.
 * Dark unless NEXUS_WALLET_ENGINE=1. Not a payment-provider top-up.
 */
export const POST = withBrowserMutation(function POST(request: NextRequest) {
  return walletSessionRequest(request, true, async (actor) => {
    if (actor.role !== "admin") throw new ForbiddenError();
    const expected = request.headers.get("x-nexus-actor-id");
    if (!expected) throw new AppError("Actor precondition required", 428, "ACTOR_ID_REQUIRED");
    if (expected !== actor.id) throw new AppError("Actor changed", 409, "ACTOR_CHANGED");
    const parsed = walletStaffGrantSchema.safeParse(await readBoundedJson(request, 2048));
    if (!parsed.success) {
      throw new AppError("Invalid staff wallet grant", 400, "WALLET_GRANT_INVALID");
    }
    return walletPaymentService.grantStaffBalance({
      actor,
      username: parsed.data.username,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      reason: parsed.data.reason,
      idempotencyKey: parsed.data.idempotencyKey,
    });
  });
});
