import { NextRequest, NextResponse } from "next/server";
import { commerceService } from "../../../lib/services/commerce-service";
import { store } from "../../../lib/services/store";
import { checkoutSchema } from "@nexus/validation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = checkoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid checkout request", details: parsed.error.format() },
        { status: 400 }
      );
    }

    // Default to player user for demo checkouts
    const buyer = store.users.get("usr_player_001") || Array.from(store.users.values())[0];

    const result = await commerceService.createOrderAndCheckout({
      buyer,
      productIds: parsed.data.items.map((i) => i.productId),
      paymentProvider: parsed.data.paymentProvider,
      serverId: parsed.data.serverId,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("Checkout API error:", error);
    return NextResponse.json(
      { error: error.message || "Checkout failed" },
      { status: error.statusCode || 500 }
    );
  }
}
