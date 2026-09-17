import { NextRequest, NextResponse } from "next/server";
import { serverService } from "../../../lib/services/server-service";
import { authService } from "../../../lib/services/auth-service";
import { createServerSchema } from "@nexus/validation";
import { consumeRateLimit, getClientIp } from "@nexus/security";
import { matchesMtaEndpoint, mtaMasterDirectoryService, type MtaMasterServer } from "../../../lib/services/mta-master-directory-service";

export async function GET() {
  const servers = await serverService.listServers();
  let observations: MtaMasterServer[] = [];
  let directoryIsStale = false;

  try {
    const directory = await mtaMasterDirectoryService.getDirectory();
    observations = directory.servers;
    directoryIsStale = directory.isStale;
  } catch {
    // Editorial listings remain available when the official directory is unavailable.
  }

  const enrichedServers = servers.map((server) => {
    const liveObservation = observations.find((observation) =>
      matchesMtaEndpoint(server, observation)
    );

    return {
      ...server,
      liveObservation: liveObservation ?? null,
      liveStatus: liveObservation
        ? liveObservation.responding === false
          ? "offline"
          : "online"
        : "unknown",
    };
  });

  return NextResponse.json(
    { servers: enrichedServers, directoryIsStale },
    { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" } }
  );
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    const rateLimit = await consumeRateLimit("serverMutation", ip);
    if (!rateLimit.success) {
      return NextResponse.json({ error: "Server registration limit exceeded" }, { status: 429 });
    }

    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const parsed = createServerSchema.safeParse(await request.json().catch(() => null));
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
