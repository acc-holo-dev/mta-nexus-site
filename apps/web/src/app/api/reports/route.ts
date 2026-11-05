import {
  contentRepository,
  productRepository,
  reportRepository,
  serverRepository,
  userRepository,
} from "@nexus/db";
import { AppError } from "@nexus/domain";
import { can, consumeRateLimit, generateId } from "@nexus/security";
import { createReportSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import { readBoundedJson, requireServerJsonContentType } from "../../../lib/bounded-json";
import { withBrowserMutation } from "../../../lib/browser-route-adapter";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
} from "../../../lib/observability";
import { isPostgresDeadlock } from "../../../lib/postgres-error";
import { authService } from "../../../lib/services/auth-service";

const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" };

function privateJson(
  context: Parameters<typeof jsonWithRequestId>[0],
  body: unknown,
  init: ResponseInit = {},
) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", privateHeaders["Cache-Control"]);
  headers.set("Vary", privateHeaders.Vary);
  return jsonWithRequestId(context, body, { ...init, headers });
}

export async function GET(request: NextRequest) {
  const context = createRequestLogContext(request);
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!user || !can(user, "admin.moderation")) {
      return privateJson(context, { error: "Unauthorized" }, { status: 403 });
    }

    const rawPage = request.nextUrl.searchParams.get("page") ?? "1";
    const view = request.nextUrl.searchParams.get("view") ?? "pending";
    if (!/^[1-9]\d{0,4}$/.test(rawPage) || !["pending", "history"].includes(view)) {
      return privateJson(context, { error: "Invalid report page or view" }, { status: 400 });
    }
    const page = Number(rawPage);
    const result = await reportRepository.listPage(view as "pending" | "history", page);
    return privateJson(context, { ...result, page, view });
  } catch (error: unknown) {
    logRequestEvent({
      level: "error",
      event: "moderation.report.list_failed",
      context,
      status: 500,
      error,
    });
    return privateJson(context, { error: "Failed to load reports" }, { status: 500 });
  }
}

export const POST = withBrowserMutation(async (request: NextRequest) => {
  const context = createRequestLogContext(request);
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!token || !user) {
      return privateJson(
        context,
        { error: "Authentication required to submit report" },
        { status: 401 },
      );
    }

    requireServerJsonContentType(request);
    // Abuse protection: limit report spam per user
    const rl = await consumeRateLimit("report", user.id);
    if (!rl.success) {
      return privateJson(
        context,
        { error: "Too many reports submitted. Please try again later." },
        { status: 429 },
      );
    }

    const body = await readBoundedJson(request);
    const parsed = createReportSchema.safeParse(body);

    if (!parsed.success) {
      return privateJson(
        context,
        { error: "Validation error", details: parsed.error.format() },
        { status: 400 },
      );
    }

    if (parsed.data.targetType === "user" && parsed.data.targetId === user.id) {
      return privateJson(context, { error: "You cannot report your own account" }, { status: 422 });
    }

    const targetExists =
      parsed.data.targetType === "product"
        ? await productRepository.findById(parsed.data.targetId)
        : parsed.data.targetType === "server"
          ? await serverRepository.findById(parsed.data.targetId)
          : parsed.data.targetType === "content"
            ? await contentRepository.findById(parsed.data.targetId)
            : parsed.data.targetType === "comment"
              ? await contentRepository.findCommentById(parsed.data.targetId)
              : await userRepository.findById(parsed.data.targetId);
    if (!targetExists) {
      return privateJson(context, { error: "Report target was not found" }, { status: 404 });
    }

    const reportId = generateId("rpt");
    const result = await reportRepository.createWithAudit(
      {
        id: reportId,
        reporterId: user.id,
        targetType: parsed.data.targetType,
        targetId: parsed.data.targetId,
        type: parsed.data.type,
        reason: parsed.data.reason,
        evidenceUrls: parsed.data.evidenceUrls,
        status: "open",
      },
      {
        id: generateId("aud"),
        actorId: user.id,
        actorType: "user",
        action: "report.created",
        targetId: reportId,
        targetType: "report",
        details: { type: parsed.data.type, targetType: parsed.data.targetType },
      },
      token,
    );
    if (!result.created) {
      return privateJson(
        context,
        { error: "You already have an open report for this target", reportId: result.report.id },
        { status: 409 },
      );
    }
    const report = result.report;

    return privateJson(context, { success: true, report }, { status: 201 });
  } catch (error: unknown) {
    if (isPostgresDeadlock(error))
      return privateJson(
        context,
        { code: "REPORT_RETRY", error: "Please retry submitting the report" },
        { status: 409 },
      );
    if (
      error instanceof AppError &&
      [
        "UNSUPPORTED_MEDIA_TYPE",
        "INVALID_BODY_LENGTH",
        "REQUEST_BODY_TOO_LARGE",
        "REQUEST_BODY_TIMEOUT",
        "UNAUTHORIZED",
        "FORBIDDEN",
      ].includes(error.code)
    ) {
      return privateJson(
        context,
        { error: error.message, code: error.code },
        { status: error.statusCode },
      );
    }
    logRequestEvent({
      level: "error",
      event: "moderation.report.submit_failed",
      context,
      status: 500,
      error,
    });
    return privateJson(context, { error: "Failed to submit report" }, { status: 500 });
  }
});
