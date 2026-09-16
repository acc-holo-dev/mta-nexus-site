import { NextRequest, NextResponse } from "next/server";
import { telemetryRepository, serverRepository } from "@nexus/db";
import { z } from "zod";
import { rateLimiter } from "@nexus/security";

const heartbeatSchema = z.object({
  apiKey: z.string().min(10),
  status: z.enum(["online", "offline", "maintenance"]).default("online"),
  currentPlayers: z.coerce.number().int().min(0).max(65535).default(0),
  maxPlayers: z.coerce.number().int().min(0).max(65535).default(0),
  moduleVersion: z.string().optional(),
  mtaVersion: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Heartbeats arrive frequently — generous but bounded
    const ip = request.headers.get("x-forwarded-for") || "local";
    const rl = await rateLimiter.consume(`heartbeat:${ip}`, 120, 60);
    if (!rl.success) {
      return NextResponse.json({ error: "Heartbeat rate exceeded" }, { status: 429 });
    }

    const body = await request.json();
    const parsed = heartbeatSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid heartbeat payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    // Authenticate the installation by its API key hash
    const installation = await telemetryRepository.findInstallationByApiKey(parsed.data.apiKey);
    if (!installation || installation.status === "revoked") {
      return NextResponse.json({ error: "Invalid or revoked installation credentials" }, { status: 401 });
    }

    const server = await serverRepository.findById(installation.serverId);
    if (!server) {
      return NextResponse.json({ error: "Bound server no longer exists" }, { status: 404 });
    }

    await telemetryRepository.recordHeartbeat({
      installationId: installation.id,
      serverId: installation.serverId,
      status: parsed.data.status,
      currentPlayers: parsed.data.currentPlayers,
      maxPlayers: parsed.data.maxPlayers,
      moduleVersion: parsed.data.moduleVersion,
      mtaVersion: parsed.data.mtaVersion,
    });

    return NextResponse.json({
      success: true,
      serverId: installation.serverId,
      recordedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Heartbeat error:", error.message);
    return NextResponse.json({ error: "Failed to process heartbeat" }, { status: 500 });
  }
}
