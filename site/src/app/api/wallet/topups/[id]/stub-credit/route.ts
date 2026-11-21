import { AppError } from "@nexus/domain";
import { walletTopUpStubCreditSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import {
  walletPaymentService,
  walletSessionRequest,
} from "../../../../../../features/commerce/wallet-http";
import { readBoundedJson } from "../../../../../../lib/http/bounded-json";
import { withBrowserMutation } from "../../../../../../lib/http/browser-route-adapter";

/**
 * Apply a stub-only verified top-up outcome for an awaiting intent.
 * Dark unless NEXUS_WALLET_ENGINE=1. Live PSP adapters stay off.
 */
export const POST = withBrowserMutation(function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return walletSessionRequest(request, true, async (actor) => {
    const expected = request.headers.get("x-nexus-actor-id");
    if (!expected) throw new AppError("Actor precondition required", 428, "ACTOR_ID_REQUIRED");
    if (expected !== actor.id) throw new AppError("Actor changed", 409, "ACTOR_CHANGED");
    const intentId = (await params).id;
    if (!/^[A-Za-z0-9_-]{8,128}$/u.test(intentId)) {
      throw new AppError("Invalid wallet top-up", 400, "WALLET_TOPUP_INVALID");
    }
    const parsed = walletTopUpStubCreditSchema.safeParse(await readBoundedJson(request, 1024));
    if (!parsed.success) {
      throw new AppError("Invalid wallet top-up", 400, "WALLET_TOPUP_INVALID");
    }
    const accountId = await walletPaymentService.resolveSellerAccountId(
      actor,
      parsed.data.organizationId,
    );
    const result = await walletPaymentService.creditStubTopUp({
      intentId,
      accountId,
      outcome: parsed.data.outcome,
    });
    return {
      accountId,
      organizationId: parsed.data.organizationId ?? null,
      kind: result.kind,
      credited: result.credited,
      intent: {
        id: result.intent.id,
        status: result.intent.status,
        amount: result.intent.amount,
        currency: result.intent.currency,
        providerId: result.intent.providerId,
      },
      actorId: actor.id,
    };
  });
});
