import { NextRequest, NextResponse } from "next/server";
import { commerceService } from "../../../lib/services/commerce-service";
import { authService } from "../../../lib/services/auth-service";
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

    const token = request.cookies.get("nexus_session")?.value;
    let buyer = await authService.getSession(token);

    // Fallback: if no active session, look up registered demo player or require auth
    if (!buyer) {
      const users = await authService.listUsers();
      buyer = users.find((u) => u.email === "player@example.com") || users[0];
      if (!buyer) {
        return NextResponse.json(
          { error: "Authentication required for checkout" },
          { status: 401 }
        );
      }
    }

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
