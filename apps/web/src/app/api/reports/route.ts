import { NextRequest, NextResponse } from "next/server";
import { authService } from "../../../lib/services/auth-service";
import {
  auditRepository,
  contentRepository,
  notificationRepository,
  productRepository,
  reportRepository,
  serverRepository,
  userRepository,
} from "@nexus/db";
import { createReportSchema } from "@nexus/validation";
import { generateId, can, consumeRateLimit } from "@nexus/security";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("nexus_session")?.value;
  const user = await authService.getSession(token);

  if (!user || !can(user, "admin.moderation")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const reports = await reportRepository.listAll();
  return NextResponse.json({ reports });
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!user) {
      return NextResponse.json({ error: "Authentication required to submit report" }, { status: 401 });
    }

    // Abuse protection: limit report spam per user
    const rl = await consumeRateLimit("report", user.id);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many reports submitted. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = createReportSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.format() },
        { status: 400 }
      );
    }

    if (parsed.data.targetType === "user" && parsed.data.targetId === user.id) {
      return NextResponse.json({ error: "You cannot report your own account" }, { status: 422 });
    }

    const targetExists = parsed.data.targetType === "product"
      ? await productRepository.findById(parsed.data.targetId)
      : parsed.data.targetType === "server"
        ? await serverRepository.findById(parsed.data.targetId)
        : parsed.data.targetType === "content"
          ? await contentRepository.findById(parsed.data.targetId)
          : await userRepository.findById(parsed.data.targetId);
    if (!targetExists) {
      return NextResponse.json({ error: "Report target was not found" }, { status: 404 });
    }

    const duplicate = await reportRepository.findOpenByReporterAndTarget(
      user.id,
      parsed.data.targetType,
      parsed.data.targetId
    );
    if (duplicate) {
      return NextResponse.json(
        { error: "You already have an open report for this target", reportId: duplicate.id },
        { status: 409 }
      );
    }

    const reportId = generateId("rpt");
    const report = await reportRepository.create({
      id: reportId,
      reporterId: user.id,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      type: parsed.data.type,
      reason: parsed.data.reason,
      evidenceUrls: parsed.data.evidenceUrls,
      status: "open",
    });

    await auditRepository.record({
      id: generateId("aud"),
      actorId: user.id,
      actorType: "user",
      action: "report.created",
      targetId: reportId,
      targetType: "report",
      details: { type: parsed.data.type, targetType: parsed.data.targetType },
    });

    const moderators = (await userRepository.listAll()).filter(
      (candidate) => candidate.role === "moderator" || candidate.role === "admin"
    );
    await Promise.all(
      moderators.map((moderator) =>
        notificationRepository.create({
          id: generateId("not"),
          recipientId: moderator.id,
          title: "New report requires review",
          message: `${parsed.data.type} report for ${parsed.data.targetType}:${parsed.data.targetId}`,
          link: "/admin",
          type: "security",
        })
      )
    );

    return NextResponse.json({ success: true, report }, { status: 201 });
  } catch (error: unknown) {
    console.error("Report submission error:", error);
    return NextResponse.json({ error: "Failed to submit report" }, { status: 500 });
  }
}
