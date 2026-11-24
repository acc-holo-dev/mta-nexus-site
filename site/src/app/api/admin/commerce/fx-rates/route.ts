import { AppError, ForbiddenError } from "@nexus/domain";
import { walletFxRateSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import {
  walletPaymentService,
  walletSessionRequest,
} from "../../../../../features/commerce/wallet-http";
import { readBoundedJson } from "../../../../../lib/http/bounded-json";
import { withBrowserMutation } from "../../../../../lib/http/browser-route-adapter";

/**
 * Admin records an explicit site-wallet exchange pair.
 * Dark unless NEXUS_WALLET_ENGINE=1. Does not move a balance.
 */
export const POST = withBrowserMutation(function POST(request: NextRequest) {
  return walletSessionRequest(request, true, async (actor) => {
    if (actor.role !== "admin") throw new ForbiddenError();
    const expected = request.headers.get("x-nexus-actor-id");
    if (!expected) throw new AppError("Actor precondition required", 428, "ACTOR_ID_REQUIRED");
    if (expected !== actor.id) throw new AppError("Actor changed", 409, "ACTOR_CHANGED");
    const parsed = walletFxRateSchema.safeParse(await readBoundedJson(request, 1024));
    if (!parsed.success) throw new AppError("Exchange rate is invalid", 400, "FX_INVALID");
    const saved = await walletPaymentService.setFxRate({ actor, ...parsed.data });
    return { ...saved, actorId: actor.id };
  });
});
