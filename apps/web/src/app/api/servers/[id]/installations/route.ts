import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { serverService } from "../../../../../lib/services/server-service";
import { authService } from "../../../../../lib/services/auth-service";
import { rateLimiter } from "@nexus/security";

const installationSchema = z.object({
  moduleVersion: z.string().min(1).max(32).default("1.0.0"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const rateLimit = await rateLimiter.consume(`installation-create:${user.id}`, 5, 3600);
    if (!rateLimit.success) {
      return NextResponse.json({ error: "Installation key limit exceeded" }, { status: 429 });
    }

    const parsed = installationSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid installation details", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { id } = await params;
    const installation = await serverService.registerInstallation(
      id,
      user,
      parsed.data.moduleVersion
    );

    return NextResponse.json(
      {
        installationId: installation.id,
        apiKey: installation.apiKey,
        serverId: installation.serverId,
        moduleVersion: installation.moduleVersion,
        warning: "This API key is shown only once. Store it securely.",
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const appError =
      error instanceof Error && "statusCode" in error
        ? (error as Error & { statusCode: number })
        : null;
    console.error("Installation registration error:", error);
    return NextResponse.json(
      { error: appError?.message || "Could not create installation key" },
      { status: appError?.statusCode || 500 }
    );
  }
}
