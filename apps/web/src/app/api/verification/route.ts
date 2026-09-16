import { NextRequest, NextResponse } from "next/server";
import { authService } from "../../../lib/services/auth-service";
import { verificationRepository } from "@nexus/db";
import { rateLimiter } from "@nexus/security";
import { z } from "zod";

const verificationRequestSchema = z.object({
  targetType: z.enum(["user", "developer", "organization", "server"]),
  targetId: z.string().min(1),
  proofUrl: z.string().url().optional().or(z.literal("")),
  notes: z.string().max(1000).optional(),
});

export async function GET(request: NextRequest) {
  const token = request.cookies.get("nexus_session")?.value;
  const user = await authService.getSession(token);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requests = await verificationRepository.listByRequester(user.id);
  return NextResponse.json({ requests });
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Limit verification request spam
    const rl = await rateLimiter.consume(`verification:${user.id}`, 3, 86400);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many verification requests. Please try again tomorrow." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = verificationRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid verification request", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const verificationRequest = await verificationRepository.createRequest({
      requesterId: user.id,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      proofUrl: parsed.data.proofUrl || undefined,
      notes: parsed.data.notes,
    });

    return NextResponse.json({ success: true, request: verificationRequest }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to submit verification request" },
      { status: 500 }
    );
  }
}
