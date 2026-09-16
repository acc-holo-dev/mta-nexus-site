import { NextRequest, NextResponse } from "next/server";
import { commerceService } from "../../../lib/services/commerce-service";
import { authService } from "../../../lib/services/auth-service";
import { checkoutSchema } from "@nexus/validation";
import { rateLimiter } from "@nexus/security";

export async function POST(request: NextRequest) {
  try {
    // Rate limit checkout attempts per IP
    const ip = request.headers.get("x-forwarded-for") || "local";
    const rl = await rateLimiter.consume(`checkout:${ip}`, 10, 60);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many checkout attempts. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = checkoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid checkout request", details: parsed.error.format() },
        { status: 400 }
      );
    }

    // Authentication is mandatory for commerce operations
    const token = request.cookies.get("nexus_session")?.value;
    const buyer = await authService.getSession(token);

    if (!buyer) {
      return NextResponse.json(
        { error: "Authentication required for checkout" },
        { status: 401 }
      );
    }

    const result = await commerceService.createOrderAndCheckout({
      buyer,
      productIds: parsed.data.items.map((i) => i.productId),
      paymentProvider: parsed.data.paymentProvider,
      serverId: parsed.data.serverId,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("Checkout API error:", error.message);
    return NextResponse.json(
      { error: error.statusCode ? error.message : "Checkout failed" },
      { status: error.statusCode || 500 }
    );
  }
}
