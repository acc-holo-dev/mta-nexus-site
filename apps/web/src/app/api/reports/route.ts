import { NextRequest } from "next/server";
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

const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" };
import { createRequestLogContext, jsonWithRequestId, logRequestEvent } from "../../../lib/observability";

export async function GET(request: NextRequest) {
  const context = createRequestLogContext(request);
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!user || !can(user, "admin.moderation")) {
      return jsonWithRequestId(context, { error: "Unauthorized" }, { status: 403 });
    }

    const reports = await reportRepository.listAll();
    return jsonWithRequestId(context, { reports });
  } catch (error: unknown) {
    logRequestEvent({
      level: "error",
      event: "moderation.report.list_failed",
      context,
      status: 500,
      error,
    });
    return jsonWithRequestId(context, { error: "Failed to load reports" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const context = createRequestLogContext(request);
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!user) {
      return jsonWithRequestId(context, { error: "Authentication required to submit report" }, { status: 401 });
    }

    // Abuse protection: limit report spam per user
    const rl = await consumeRateLimit("report", user.id);
    if (!rl.success) {
      return jsonWithRequestId(context, 
        { error: "Too many reports submitted. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = createReportSchema.safeParse(body);

    if (!parsed.success) {
      return jsonWithRequestId(context, 
        { error: "Validation error", details: parsed.error.format() },
        { status: 400 }
      );
    }

    if (parsed.data.targetType === "user" && parsed.data.targetId === user.id) {
      return jsonWithRequestId(context, { error: "You cannot report your own account" }, { status: 422 });
    }

    const targetExists = parsed.data.targetType === "product"
      ? await productRepository.findById(parsed.data.targetId)
      : parsed.data.targetType === "server"
        ? await serverRepository.findById(parsed.data.targetId)
        : parsed.data.targetType === "content"
          ? await contentRepository.findById(parsed.data.targetId)
          : parsed.data.targetType === "comment"
            ? await contentRepository.findCommentById(parsed.data.targetId)
            : await userRepository.findById(parsed.data.targetId);
    if (!targetExists) {
      return jsonWithRequestId(context, { error: "Report target was not found" }, { status: 404 });
    }

    const duplicate = await reportRepository.findOpenByReporterAndTarget(
      user.id,
      parsed.data.targetType,
      parsed.data.targetId
    );
    if (duplicate) {
      return jsonWithRequestId(context, 
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

    return jsonWithRequestId(context, { success: true, report }, { status: 201 });
  } catch (error: unknown) {
    logRequestEvent({
      level: "error",
      event: "moderation.report.submit_failed",
      context,
      status: 500,
      error,
    });
    return jsonWithRequestId(context, { error: "Failed to submit report" }, { status: 500 });
  }
}
