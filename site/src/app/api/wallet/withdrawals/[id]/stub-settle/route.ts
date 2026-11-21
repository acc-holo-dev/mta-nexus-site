import { AppError } from "@nexus/domain";
import { walletWithdrawalStubSettleSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import {
  walletPaymentService,
  walletSessionRequest,
} from "../../../../../../features/commerce/wallet-http";
import { readBoundedJson } from "../../../../../../lib/http/bounded-json";
import { withBrowserMutation } from "../../../../../../lib/http/browser-route-adapter";
import { isWalletWithdrawEnabled } from "../../../../../../lib/services/commerce/wallet-payment-service";

/**
 * Apply a stub-only verified payout outcome for an awaiting withdrawal.
 * Dark unless NEXUS_WALLET_ENGINE=1 and NEXUS_WALLET_WITHDRAW=1. Live adapters stay off.
 */
export const POST = withBrowserMutation(function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return walletSessionRequest(request, true, async (actor) => {
    if (!isWalletWithdrawEnabled()) {
      throw new AppError("Wallet withdrawals are disabled", 404, "WALLET_WITHDRAW_DISABLED");
    }
    const expected = request.headers.get("x-nexus-actor-id");
    if (!expected) throw new AppError("Actor precondition required", 428, "ACTOR_ID_REQUIRED");
    if (expected !== actor.id) throw new AppError("Actor changed", 409, "ACTOR_CHANGED");
    const intentId = (await params).id;
    if (!/^[A-Za-z0-9_-]{8,128}$/u.test(intentId)) {
      throw new AppError("Invalid wallet withdrawal", 400, "WALLET_WITHDRAW_INVALID");
    }
    const parsed = walletWithdrawalStubSettleSchema.safeParse(await readBoundedJson(request, 1024));
    if (!parsed.success) {
      throw new AppError("Invalid wallet withdrawal", 400, "WALLET_WITHDRAW_INVALID");
    }
    const accountId = await walletPaymentService.resolveSellerAccountId(
      actor,
      parsed.data.organizationId,
    );
    const result = await walletPaymentService.settleStubWithdrawal({
      intentId,
      accountId,
      outcome: parsed.data.outcome,
    });
    return {
      accountId,
      organizationId: parsed.data.organizationId ?? null,
      kind: result.kind,
      settled: result.settled,
      intent: {
        id: result.intent.id,
        status: result.intent.status,
        amount: result.intent.amount,
        currency: result.intent.currency,
        providerId: result.intent.providerId,
        escrowAccountId: result.intent.escrowAccountId,
      },
      actorId: actor.id,
    };
  });
});
