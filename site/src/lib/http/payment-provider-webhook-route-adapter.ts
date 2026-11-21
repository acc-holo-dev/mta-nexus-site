import type { NextRequest } from "next/server";

/** Stable marker for contract/inventory scans — machine payment-provider webhook boundary. */
export const PAYMENT_PROVIDER_WEBHOOK_ROUTE_ADAPTER = "payment-provider-webhook-v1" as const;

/**
 * Independent of browser CSRF. Provider signature verification is required inside the
 * handler; cookies never authorize these routes. Proxy skips CSRF only for exact
 * `/api/wallet/providers/{stub|stripe|yookassa|crypto}/webhook` paths.
 */
export function withPaymentProviderWebhook<TArgs extends unknown[]>(
  handler: (request: NextRequest, ...args: TArgs) => Response | Promise<Response>,
): (request: NextRequest, ...args: TArgs) => Promise<Response> {
  return async (request, ...args) => handler(request, ...args);
}
