import { NextRequest, NextResponse } from "next/server";
import { authService } from "../../../lib/services/auth-service";
import {
  auditRepository,
  notificationRepository,
  organizationRepository,
  serverRepository,
  userRepository,
  verificationRepository,
} from "@nexus/db";
import { generateId, rateLimiter } from "@nexus/security";
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

    let targetIsVerified = false;
    if (parsed.data.targetType === "user" || parsed.data.targetType === "developer") {
      if (parsed.data.targetId !== user.id) {
        return NextResponse.json({ error: "You can only verify your own profile" }, { status: 403 });
      }
      targetIsVerified = user.isVerified;
    } else if (parsed.data.targetType === "server") {
      const server = await serverRepository.findById(parsed.data.targetId);
      if (!server) {
        return NextResponse.json({ error: "Server was not found" }, { status: 404 });
      }
      if (server.ownerId !== user.id) {
        return NextResponse.json({ error: "You do not own this server" }, { status: 403 });
      }
      targetIsVerified = server.isVerified;
    } else {
      const organization = await organizationRepository.findById(parsed.data.targetId);
      if (!organization) {
        return NextResponse.json({ error: "Organization was not found" }, { status: 404 });
      }
      const memberships = await organizationRepository.listUserMemberships(user.id);
      const membership = memberships.find((candidate) => candidate.organizationId === organization.id);
      if (
        organization.ownerId !== user.id &&
        (!membership || (membership.role !== "owner" && membership.role !== "admin"))
      ) {
        return NextResponse.json({ error: "You do not manage this organization" }, { status: 403 });
      }
      targetIsVerified = organization.isVerified;
    }

    if (targetIsVerified) {
      return NextResponse.json({ error: "This target is already verified" }, { status: 409 });
    }

    const duplicate = await verificationRepository.findPendingForTarget(
      user.id,
      parsed.data.targetType,
      parsed.data.targetId
    );
    if (duplicate) {
      return NextResponse.json(
        { error: "A verification request is already pending", requestId: duplicate.id },
        { status: 409 }
      );
    }

    const verificationRequest = await verificationRepository.createRequest({
      requesterId: user.id,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      proofUrl: parsed.data.proofUrl || undefined,
      notes: parsed.data.notes,
    });

    await auditRepository.record({
      id: generateId("aud"),
      actorId: user.id,
      actorType: "user",
      action: "verification.requested",
      targetId: verificationRequest.id,
      targetType: "verification",
      details: { targetType: parsed.data.targetType, targetId: parsed.data.targetId },
    });

    const moderators = (await userRepository.listAll()).filter(
      (candidate) => candidate.role === "moderator" || candidate.role === "admin"
    );
    await Promise.all(
      moderators.map((moderator) =>
        notificationRepository.create({
          id: generateId("not"),
          recipientId: moderator.id,
          title: "New verification request",
          message: `${parsed.data.targetType} verification requested for ${parsed.data.targetId}`,
          link: "/admin",
          type: "security",
        })
      )
    );

    return NextResponse.json({ success: true, request: verificationRequest }, { status: 201 });
  } catch (error: unknown) {
    console.error("Verification request error:", error);
    return NextResponse.json({ error: "Failed to submit verification request" }, { status: 500 });
  }
}
