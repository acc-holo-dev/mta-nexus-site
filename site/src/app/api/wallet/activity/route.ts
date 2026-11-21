import { AppError } from "@nexus/domain";
import { walletActivityQuerySchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import {
  walletPaymentService,
  walletSessionRequest,
} from "../../../../features/commerce/wallet-http";

/**
 * Recent audited ledger lines for the caller's personal or organization site wallet.
 * Organization access requires owner/admin. Dark unless NEXUS_WALLET_ENGINE=1.
 */
export function GET(request: NextRequest) {
  return walletSessionRequest(request, false, async (actor) => {
    const parsed = walletActivityQuerySchema.safeParse({
      currency: request.nextUrl.searchParams.get("currency") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
      organizationId: request.nextUrl.searchParams.get("organizationId") ?? undefined,
    });
    if (!parsed.success) {
      throw new AppError("Invalid wallet activity query", 400, "WALLET_ACTIVITY_INVALID");
    }
    const accountId = await walletPaymentService.resolveSellerAccountId(
      actor,
      parsed.data.organizationId,
    );
    const entries = await walletPaymentService.listRecentActivity(
      accountId,
      parsed.data.currency,
      parsed.data.limit ?? 20,
    );
    return {
      accountId,
      organizationId: parsed.data.organizationId ?? null,
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
