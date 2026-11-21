import { AppError } from "@nexus/domain";
import { walletTopUpCreateSchema, walletTopUpQuerySchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import {
  walletPaymentService,
  walletSessionRequest,
} from "../../../../features/commerce/wallet-http";
import { readBoundedJson } from "../../../../lib/http/bounded-json";
import { withBrowserMutation } from "../../../../lib/http/browser-route-adapter";

/**
 * List recent top-up intents for personal or organization wallets.
 * Org requires owner/admin. Dark unless NEXUS_WALLET_ENGINE=1.
 */
export function GET(request: NextRequest) {
  return walletSessionRequest(request, false, async (actor) => {
    const parsed = walletTopUpQuerySchema.safeParse({
      currency: request.nextUrl.searchParams.get("currency") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
      organizationId: request.nextUrl.searchParams.get("organizationId") ?? undefined,
    });
    if (!parsed.success) {
      throw new AppError("Invalid wallet top-up query", 400, "WALLET_TOPUP_INVALID");
    }
    const accountId = await walletPaymentService.resolveSellerAccountId(
      actor,
      parsed.data.organizationId,
    );
    const intents = await walletPaymentService.listRecentTopUps(accountId, parsed.data.limit ?? 20);
    return {
      accountId,
      organizationId: parsed.data.organizationId ?? null,
      currency: parsed.data.currency,
      topUps: intents
        .filter((intent) => intent.currency === parsed.data.currency)
        .map((intent) => ({
          id: intent.id,
          status: intent.status,
          amount: intent.amount,
          currency: intent.currency,
          providerId: intent.providerId,
          createdAt: intent.createdAt,
        })),
    };
  });
}

/** Personal or organization top-up. Org requires owner/admin membership. */
export const POST = withBrowserMutation(function POST(request: NextRequest) {
  return walletSessionRequest(request, true, async (actor) => {
    const parsed = walletTopUpCreateSchema.safeParse(await readBoundedJson(request, 4096));
    if (!parsed.success) {
      throw new AppError("Invalid wallet top-up", 400, "WALLET_TOPUP_INVALID");
    }
    const accountId = await walletPaymentService.resolveSellerAccountId(
      actor,
      parsed.data.organizationId,
    );
    const started = await walletPaymentService.startTopUp({
      accountId,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      providerId: parsed.data.providerId,
      idempotencyKey: parsed.data.idempotencyKey,
      returnPath: parsed.data.returnPath,
    });
    return {
      accountId,
      organizationId: parsed.data.organizationId ?? null,
      intent: {
        id: started.intent.id,
        status: started.intent.status,
        amount: started.intent.amount,
        currency: started.intent.currency,
        providerId: started.intent.providerId,
        createdAt: started.intent.createdAt,
      },
      redirectUrl: started.redirectUrl,
    };
  });
});
