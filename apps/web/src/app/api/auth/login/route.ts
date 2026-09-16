import { NextRequest, NextResponse } from "next/server";
import { authService } from "../../../../lib/services/auth-service";
import { loginSchema } from "@nexus/validation";
import { rateLimiter } from "@nexus/security";

export async function POST(request: NextRequest) {
  try {
    // Brute-force mitigation: strict per-IP limit on login attempts
    const ip = request.headers.get("x-forwarded-for") || "local";
    const rl = await rateLimiter.consume(`login:${ip}`, 8, 300);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again in a few minutes." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid login credentials", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { user, token } = await authService.login(parsed.data);

    const response = NextResponse.json({ success: true, user });
    response.cookies.set("nexus_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 14, // 14 days
      path: "/",
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to log in" },
      { status: error.statusCode || 401 }
    );
  }
}
