import { AppError } from "@nexus/domain";
import { walletBalanceQuerySchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import {
  walletPaymentService,
  walletSessionRequest,
} from "../../../../features/commerce/wallet-http";

export function GET(request: NextRequest) {
  return walletSessionRequest(request, false, async (actor) => {
    const parsed = walletBalanceQuerySchema.safeParse({
      currency: request.nextUrl.searchParams.get("currency") ?? undefined,
      organizationId: request.nextUrl.searchParams.get("organizationId") ?? undefined,
    });
    if (!parsed.success) {
      throw new AppError("Invalid wallet balance query", 400, "WALLET_BALANCE_INVALID");
    }
    const accountId = await walletPaymentService.resolveSellerAccountId(
      actor,
      parsed.data.organizationId,
    );
    const available = await walletPaymentService.getAvailableBalance(
      accountId,
      parsed.data.currency,
    );
    return {
      accountId,
      organizationId: parsed.data.organizationId ?? null,
      currency: parsed.data.currency,
      available,
    };
  });
}
