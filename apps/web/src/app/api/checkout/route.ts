import type { NextRequest } from "next/server";
import {
  createRequestLogContext,
  jsonWithRequestId,
} from "../../../lib/observability";

/**
 * Paid checkout is intentionally unavailable in the player-first closed beta.
 * Do not add a provider here until the legal, refund and payout flows are ready.
 */
export async function POST(request: NextRequest) {
  const context = createRequestLogContext(request);
  return jsonWithRequestId(
    context,
    {
      error:
        "Paid checkout is not available during the closed beta.",
      code: "CHECKOUT_DISABLED",
    },
    {
      status: 503,
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}
