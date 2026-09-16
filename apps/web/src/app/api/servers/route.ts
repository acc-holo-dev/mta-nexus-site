import { NextRequest, NextResponse } from "next/server";
import { serverService } from "../../../lib/services/server-service";
import { authService } from "../../../lib/services/auth-service";
import { createServerSchema } from "@nexus/validation";
import { rateLimiter } from "@nexus/security";

export async function GET() {
  const servers = await serverService.listServers();
  return NextResponse.json({ servers });
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "local";
    const rateLimit = await rateLimiter.consume(`server-create:${ip}`, 5, 3600);
    if (!rateLimit.success) {
      return NextResponse.json({ error: "Server registration limit exceeded" }, { status: 429 });
    }

    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const parsed = createServerSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid server details", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const server = await serverService.createServer(
      { ...parsed.data, ownerId: user.id },
      user
    );
    return NextResponse.json({ server }, { status: 201 });
  } catch (error: unknown) {
    const appError =
      error instanceof Error && "statusCode" in error
        ? (error as Error & { statusCode: number })
        : null;
    console.error("Server registration error:", error);
    return NextResponse.json(
      { error: appError?.message || "Could not register server" },
      { status: appError?.statusCode || 500 }
    );
  }
}
