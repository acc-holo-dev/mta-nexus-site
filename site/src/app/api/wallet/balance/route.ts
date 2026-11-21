import { AppError } from "@nexus/domain";
import { walletBalanceQuerySchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import {
  walletAccountIdForUser,
  walletPaymentService,
  walletSessionRequest,
} from "../../../../features/commerce/wallet-http";

export function GET(request: NextRequest) {
  return walletSessionRequest(request, false, async (actor) => {
    const parsed = walletBalanceQuerySchema.safeParse({
      currency: request.nextUrl.searchParams.get("currency") ?? undefined,
    });
    if (!parsed.success) {
      throw new AppError("Invalid wallet balance query", 400, "WALLET_BALANCE_INVALID");
    }
    const accountId = walletAccountIdForUser(actor.id);
    const available = await walletPaymentService.getAvailableBalance(
      accountId,
      parsed.data.currency,
    );
    return {
      accountId,
      currency: parsed.data.currency,
      available,
    };
  });
}
