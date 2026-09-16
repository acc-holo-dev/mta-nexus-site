import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { telemetryRepository, serverRepository } from "@nexus/db";
import { z } from "zod";
import { rateLimiter } from "@nexus/security";

const heartbeatSchema = z
  .object({
    apiKey: z.string().min(10),
    status: z.enum(["online", "offline", "maintenance"]).default("online"),
    currentPlayers: z.coerce.number().int().min(0).max(4096).default(0),
    maxPlayers: z.coerce.number().int().min(1).max(4096),
    moduleVersion: z.string().max(32).optional(),
    mtaVersion: z.string().max(32).optional(),
  })
  .refine((value) => value.currentPlayers <= value.maxPlayers, {
    message: "Current players cannot exceed maximum players",
    path: ["currentPlayers"],
  });

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "local";
    const rateLimit = await rateLimiter.consume(`heartbeat:${ip}`, 120, 60);
    if (!rateLimit.success) {
      return NextResponse.json({ error: "Heartbeat rate exceeded" }, { status: 429 });
    }

    const parsed = heartbeatSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid heartbeat payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const apiKeyHash = crypto
      .createHash("sha256")
      .update(parsed.data.apiKey)
      .digest("hex");
    const installation =
      await telemetryRepository.findInstallationByApiKeyHash(apiKeyHash);
    if (!installation || installation.status !== "active") {
      return NextResponse.json(
        { error: "Invalid or inactive installation credentials" },
        { status: 401 }
      );
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
  } catch (error: unknown) {
    console.error("Heartbeat error:", error);
    return NextResponse.json({ error: "Failed to process heartbeat" }, { status: 500 });
  }
}
