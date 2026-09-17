import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authService } from "../../../../lib/services/auth-service";
import { serverService } from "../../../../lib/services/server-service";
import { rateLimiter } from "@nexus/security";

const serverUpdateSchema = z
  .object({
    name: z.string().min(3).max(100).optional(),
    description: z.string().max(5000).optional(),
    ipAddress: z.string().min(1).optional(),
    port: z.coerce.number().int().min(1).max(65535).optional(),
    httpPort: z.coerce.number().int().min(1).max(65535).optional(),
    gameMode: z.string().max(64).optional(),
    mapName: z.string().max(64).optional(),
    maxPlayers: z.coerce.number().int().min(1).max(4096).optional(),
    visibility: z.enum(["public", "unlisted", "private"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const rateLimit = await rateLimiter.consume("server-update:" + user.id, 30, 3600);
    if (!rateLimit.success) {
      return NextResponse.json({ error: "Server update limit exceeded" }, { status: 429 });
    }

    const parsed = serverUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid server details", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { id } = await params;
    const server = await serverService.updateServer(id, parsed.data, user);
    return NextResponse.json({ server });
  } catch (error: unknown) {
    const appError = error instanceof Error && "statusCode" in error
      ? (error as Error & { statusCode: number })
      : null;
    console.error("Server update error:", error);
    return NextResponse.json(
      { error: appError?.message || "Could not update server" },
      { status: appError?.statusCode || 500 }
    );
  }
}
