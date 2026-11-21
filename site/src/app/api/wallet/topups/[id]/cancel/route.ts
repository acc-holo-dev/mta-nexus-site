import { AppError } from "@nexus/domain";
import { walletTopUpCancelSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import {
  walletPaymentService,
  walletSessionRequest,
} from "../../../../../../features/commerce/wallet-http";
import { readBoundedJson } from "../../../../../../lib/http/bounded-json";
import { withBrowserMutation } from "../../../../../../lib/http/browser-route-adapter";

/**
 * Cancel an awaiting/created top-up before a verified provider credit.
 * Org requires owner/admin. Dark unless NEXUS_WALLET_ENGINE=1. No ledger posting.
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
    const parsed = walletTopUpCancelSchema.safeParse(await readBoundedJson(request, 1024));
    if (!parsed.success) {
      throw new AppError("Invalid wallet top-up", 400, "WALLET_TOPUP_INVALID");
    }
    const accountId = await walletPaymentService.resolveSellerAccountId(
      actor,
      parsed.data.organizationId,
    );
    const { intent } = await walletPaymentService.cancelTopUp({
      intentId,
      accountId,
    });
    return {
      accountId,
      organizationId: parsed.data.organizationId ?? null,
      intent: {
        id: intent.id,
        status: intent.status,
        amount: intent.amount,
        currency: intent.currency,
        providerId: intent.providerId,
      },
      actorId: actor.id,
    };
  });
});
