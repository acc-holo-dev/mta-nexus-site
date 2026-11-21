import type { NextRequest } from "next/server";
import { checkoutApiCopy } from "../../../features/commerce/checkout-api-copy";
import { withBrowserMutation } from "../../../lib/http/browser-route-adapter";
import { resolveLocale } from "../../../lib/i18n";
import { createRequestLogContext, jsonWithRequestId } from "../../../lib/platform/observability";

/**
 * Card / live PSP checkout stays intentionally disabled.
 * Site-wallet create+settle lives on POST /api/checkout/wallet under NEXUS_WALLET_ENGINE.
 */
export const POST = withBrowserMutation(async function POST(request: NextRequest) {
  const context = createRequestLogContext(request);
  const copy = checkoutApiCopy(resolveLocale(request.cookies.get("nexus_locale")?.value));
  return jsonWithRequestId(
    context,
    {
      error: copy.disabled,
      code: "CHECKOUT_DISABLED",
    },
    {
      status: 503,
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
});
