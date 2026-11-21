import { AppError } from "@nexus/domain";
import { walletActivityQuerySchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import {
  walletAccountIdForUser,
  walletPaymentService,
  walletSessionRequest,
} from "../../../../features/commerce/wallet-http";

/**
 * Recent audited ledger lines for the caller's site wallet.
 * Dark unless NEXUS_WALLET_ENGINE=1.
 */
export function GET(request: NextRequest) {
  return walletSessionRequest(request, false, async (actor) => {
    const parsed = walletActivityQuerySchema.safeParse({
      currency: request.nextUrl.searchParams.get("currency") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
    });
    if (!parsed.success) {
      throw new AppError("Invalid wallet activity query", 400, "WALLET_ACTIVITY_INVALID");
    }
    const accountId = walletAccountIdForUser(actor.id);
    const entries = await walletPaymentService.listRecentActivity(
      accountId,
      parsed.data.currency,
      parsed.data.limit ?? 20,
    );
    return {
      accountId,
      currency: parsed.data.currency,
      entries: entries.map((entry) => ({
        id: entry.id,
        amount: entry.amount,
        currency: entry.currency,
        referenceType: entry.referenceType,
        referenceId: entry.referenceId,
        balanceAfter: entry.balanceAfter,
        description: entry.description,
        createdAt: entry.createdAt,
      })),
    };
  });
}
