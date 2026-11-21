import { AppError } from "@nexus/domain";
import { walletWithdrawalCreateSchema, walletWithdrawalQuerySchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import {
  walletPaymentService,
  walletSessionRequest,
} from "../../../../features/commerce/wallet-http";
import { readBoundedJson } from "../../../../lib/http/bounded-json";
import { withBrowserMutation } from "../../../../lib/http/browser-route-adapter";
import { isWalletWithdrawEnabled } from "../../../../lib/services/commerce/wallet-payment-service";

/**
 * List recent withdrawal intents for personal or organization wallets.
 * Org requires owner/admin. Dark unless NEXUS_WALLET_ENGINE=1 and NEXUS_WALLET_WITHDRAW=1.
 */
export function GET(request: NextRequest) {
  return walletSessionRequest(request, false, async (actor) => {
    if (!isWalletWithdrawEnabled()) {
      throw new AppError("Wallet withdrawals are disabled", 404, "WALLET_WITHDRAW_DISABLED");
    }
    const parsed = walletWithdrawalQuerySchema.safeParse({
      currency: request.nextUrl.searchParams.get("currency") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
      organizationId: request.nextUrl.searchParams.get("organizationId") ?? undefined,
    });
    if (!parsed.success) {
      throw new AppError("Invalid wallet withdrawal query", 400, "WALLET_WITHDRAW_INVALID");
    }
    const accountId = await walletPaymentService.resolveSellerAccountId(
      actor,
      parsed.data.organizationId,
    );
    const intents = await walletPaymentService.listRecentWithdrawals(
      accountId,
      parsed.data.limit ?? 20,
    );
    return {
      accountId,
      organizationId: parsed.data.organizationId ?? null,
      currency: parsed.data.currency,
      withdrawals: intents
        .filter((intent) => intent.currency === parsed.data.currency)
        .map((intent) => ({
          id: intent.id,
          status: intent.status,
          amount: intent.amount,
          currency: intent.currency,
          providerId: intent.providerId,
          escrowAccountId: intent.escrowAccountId,
          createdAt: intent.createdAt,
        })),
    };
  });
}

/**
 * Start a production-shaped withdrawal hold for personal or organization wallets.
 * Org requires owner/admin. Dark unless NEXUS_WALLET_ENGINE=1 and NEXUS_WALLET_WITHDRAW=1.
 * Live payout adapters stay off.
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
    const accountId = await walletPaymentService.resolveSellerAccountId(
      actor,
      parsed.data.organizationId,
    );
    const { intent } = await walletPaymentService.startWithdrawal({
      accountId,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      providerId: parsed.data.providerId,
      idempotencyKey: parsed.data.idempotencyKey,
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
        escrowAccountId: intent.escrowAccountId,
      },
      actorId: actor.id,
    };
  });
});
