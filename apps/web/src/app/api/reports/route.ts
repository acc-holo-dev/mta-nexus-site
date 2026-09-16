import { NextRequest, NextResponse } from "next/server";
import { authService } from "../../../lib/services/auth-service";
import { reportRepository, auditRepository } from "@nexus/db";
import { createReportSchema } from "@nexus/validation";
import { generateId, can } from "@nexus/security";

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

    const body = await request.json();
    const parsed = createReportSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.format() },
        { status: 400 }
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

    return NextResponse.json({ success: true, report }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to submit report" },
      { status: 500 }
    );
  }
}
