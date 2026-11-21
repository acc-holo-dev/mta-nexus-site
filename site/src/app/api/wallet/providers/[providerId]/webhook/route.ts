import { AppError } from "@nexus/domain";
import { walletProviderIdSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import {
  requestHeaderRecord,
  walletPaymentService,
  walletWebhookRequest,
} from "../../../../../../features/commerce/wallet-http";
import { readBoundedText } from "../../../../../../lib/http/bounded-json";
import { withPaymentProviderWebhook } from "../../../../../../lib/http/payment-provider-webhook-route-adapter";

type RouteContext = { params: Promise<{ providerId: string }> };

export const POST = withPaymentProviderWebhook(async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  return walletWebhookRequest(request, async () => {
    const { providerId: rawProviderId } = await context.params;
    const parsedProvider = walletProviderIdSchema.safeParse(rawProviderId);
    if (!parsedProvider.success) {
      throw new AppError("Payment provider is unknown", 400, "PAYMENT_PROVIDER_UNKNOWN");
    }
    const rawBody = await readBoundedText(request, 64 * 1024);
    const result = await walletPaymentService.applyVerifiedWebhook(
      parsedProvider.data,
      rawBody,
      requestHeaderRecord(request),
    );
    return {
      intent: {
        id: result.intent.id,
        status: result.intent.status,
        amount: result.intent.amount,
        currency: result.intent.currency,
        providerId: result.intent.providerId,
      },
      kind: result.kind,
      credited: result.kind.startsWith("topup_") && result.entries !== null,
      settled: result.kind.startsWith("payout_") && result.entries !== null,
    };
  });
});
