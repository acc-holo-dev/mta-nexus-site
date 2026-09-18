import { NextResponse } from "next/server";

/**
 * Paid checkout is intentionally unavailable in the player-first closed beta.
 * Do not add a provider here until the legal, refund and payout flows are ready.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "Paid checkout is not available during the closed beta.",
      code: "CHECKOUT_DISABLED",
    },
    { status: 503 }
  );
}
