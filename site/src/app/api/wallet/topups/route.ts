import { AppError } from "@nexus/domain";
import { walletTopUpCreateSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import {
  walletAccountIdForUser,
  walletPaymentService,
  walletSessionRequest,
} from "../../../../features/commerce/wallet-http";
import { readBoundedJson } from "../../../../lib/http/bounded-json";
import { withBrowserMutation } from "../../../../lib/http/browser-route-adapter";

export const POST = withBrowserMutation(function POST(request: NextRequest) {
  return walletSessionRequest(request, true, async (actor) => {
    const parsed = walletTopUpCreateSchema.safeParse(await readBoundedJson(request, 4096));
    if (!parsed.success) {
      throw new AppError("Invalid wallet top-up", 400, "WALLET_TOPUP_INVALID");
    }
    const started = await walletPaymentService.startTopUp({
      accountId: walletAccountIdForUser(actor.id),
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      providerId: parsed.data.providerId,
      idempotencyKey: parsed.data.idempotencyKey,
      returnPath: parsed.data.returnPath,
    });
    return {
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
