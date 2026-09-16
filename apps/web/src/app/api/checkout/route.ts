import { NextRequest, NextResponse } from "next/server";
import { commerceService } from "../../../lib/services/commerce-service";
import { authService } from "../../../lib/services/auth-service";
import { checkoutSchema } from "@nexus/validation";
import { rateLimiter } from "@nexus/security";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "local";
    const rateLimit = await rateLimiter.consume(`checkout:${ip}`, 10, 60);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many checkout attempts. Please try again later." },
        { status: 429 }
      );
    }

    const parsed = checkoutSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid checkout request", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const token = request.cookies.get("nexus_session")?.value;
    const buyer = await authService.getSession(token);
    if (!buyer) {
      return NextResponse.json({ error: "Authentication required for checkout" }, { status: 401 });
    }

    await commerceService.createOrderAndCheckout();
  } catch (error: unknown) {
    const appError =
      error instanceof Error && "statusCode" in error
        ? (error as Error & { statusCode: number })
        : null;
    console.error("Checkout API error:", error);
    return NextResponse.json(
      { error: appError?.message || "Checkout failed" },
      { status: appError?.statusCode || 500 }
    );
  }
}
