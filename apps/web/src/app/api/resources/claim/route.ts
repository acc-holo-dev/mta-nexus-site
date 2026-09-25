import { NextRequest, NextResponse } from "next/server";
import { commerceService } from "../../../../lib/services/commerce-service";
import { authService } from "../../../../lib/services/auth-service";
import { claimResourceSchema } from "@nexus/validation";
import { consumeRateLimit } from "@nexus/security";
import { getTrustedRequestIp } from "../../../../lib/request-client-ip";

export async function POST(request: NextRequest) {
  try {
    const ip = getTrustedRequestIp(request);
    const rateLimit = await consumeRateLimit("resourceClaim", ip);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many resource claims. Please try again later." },
        { status: 429 }
      );
    }

    const parsed = claimResourceSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid resource claim", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const result = await commerceService.claimFreeResource({
      user,
      productId: parsed.data.productId,
    });

    return NextResponse.json(result, { status: result.alreadyClaimed ? 200 : 201 });
  } catch (error: unknown) {
    const appError =
      error instanceof Error && "statusCode" in error
        ? (error as Error & { statusCode: number })
        : null;
    console.error("Resource claim API error:", error);
    return NextResponse.json(
      { error: appError?.message || "Resource claim failed" },
      { status: appError?.statusCode || 500 }
    );
  }
}
