import type { NextRequest } from "next/server";
import {
  walletPaymentService,
  walletSessionRequest,
} from "../../../../features/commerce/wallet-http";
import { isWalletWithdrawEnabled } from "../../../../lib/services/commerce/wallet-payment-service";

/**
 * Session capability matrix for checkout/top-up UI.
 * Dark unless NEXUS_WALLET_ENGINE=1. liveConfigured stays false until PSP adapters.
 */
export function GET(request: NextRequest) {
  return walletSessionRequest(request, false, async () => ({
    providers: walletPaymentService.capabilityMatrix(),
    withdrawEnabled: isWalletWithdrawEnabled(),
  }));
}
