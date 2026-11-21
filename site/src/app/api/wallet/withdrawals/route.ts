import { AppError } from "@nexus/domain";
import { walletWithdrawalCreateSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import {
  walletAccountIdForUser,
  walletPaymentService,
  walletSessionRequest,
} from "../../../../features/commerce/wallet-http";
import { readBoundedJson } from "../../../../lib/http/bounded-json";
import { withBrowserMutation } from "../../../../lib/http/browser-route-adapter";
import { isWalletWithdrawEnabled } from "../../../../lib/services/commerce/wallet-payment-service";

/**
 * Start a production-shaped withdrawal hold. Dark unless
 * NEXUS_WALLET_ENGINE=1 and NEXUS_WALLET_WITHDRAW=1. Live payout adapters stay off.
 */
export const POST = withBrowserMutation(function POST(request: NextRequest) {
  return walletSessionRequest(request, true, async (actor) => {
    if (!isWalletWithdrawEnabled()) {
      throw new AppError("Wallet withdrawals are disabled", 404, "WALLET_WITHDRAW_DISABLED");
    }
    const expected = request.headers.get("x-nexus-actor-id");
    if (!expected) throw new AppError("Actor precondition required", 428, "ACTOR_ID_REQUIRED");
    if (expected !== actor.id) throw new AppError("Actor changed", 409, "ACTOR_CHANGED");
    const parsed = walletWithdrawalCreateSchema.safeParse(await readBoundedJson(request, 1024));
    if (!parsed.success) {
      throw new AppError("Invalid wallet withdrawal", 400, "WALLET_WITHDRAW_INVALID");
    }
    const accountId = walletAccountIdForUser(actor.id);
    const { intent } = await walletPaymentService.startWithdrawal({
      accountId,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      providerId: parsed.data.providerId,
      idempotencyKey: parsed.data.idempotencyKey,
    });
    return {
      intent: {
        id: intent.id,
        status: intent.status,
        amount: intent.amount,
        currency: intent.currency,
        providerId: intent.providerId,
        escrowAccountId: intent.escrowAccountId,
      },
      actorId: actor.id,
    };
  });
});
