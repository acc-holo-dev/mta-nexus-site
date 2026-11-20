import { AppError } from "@nexus/domain";
import { can, consumeRateLimit, generateId } from "@nexus/security";
import { createReportSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import { reportsApiCopy } from "../../../features/moderation/reports-api-copy";
import { readBoundedJson, requireServerJsonContentType } from "../../../lib/http/bounded-json";
import { withBrowserMutation } from "../../../lib/http/browser-route-adapter";
import { localeAppErrorText } from "../../../lib/http/locale-app-error";
import { resolveLocale } from "../../../lib/i18n";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
} from "../../../lib/platform/observability";
import { isPostgresDeadlock } from "../../../lib/platform/postgres-error";
import { authService } from "../../../lib/services/accounts/auth-service";
import { platformReportService } from "../../../lib/services/moderation/platform-report-service";

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
  const copy = reportsApiCopy(resolveLocale(request.cookies.get("nexus_locale")?.value));
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!user || !can(user, "admin.moderation")) {
      return privateJson(context, { error: copy.unauthorized }, { status: 403 });
    }

    const rawPage = request.nextUrl.searchParams.get("page") ?? "1";
    const view = request.nextUrl.searchParams.get("view") ?? "pending";
    if (!/^[1-9]\d{0,4}$/.test(rawPage) || !["pending", "history"].includes(view)) {
      return privateJson(context, { error: copy.invalidPageOrView }, { status: 400 });
    }
    const page = Number(rawPage);
    const result = await platformReportService.listPage(view as "pending" | "history", page);
    return privateJson(context, { ...result, page, view });
  } catch (error: unknown) {
    logRequestEvent({
      level: "error",
      event: "moderation.report.list_failed",
      context,
      status: 500,
      error,
    });
    return privateJson(context, { error: copy.listFailed }, { status: 500 });
  }
}

export const POST = withBrowserMutation(async (request: NextRequest) => {
  const context = createRequestLogContext(request);
  const copy = reportsApiCopy(resolveLocale(request.cookies.get("nexus_locale")?.value));
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!token || !user) {
      return privateJson(context, { error: copy.authenticationRequired }, { status: 401 });
    }

    requireServerJsonContentType(request);
    // Abuse protection: limit report spam per user
    const rl = await consumeRateLimit("report", user.id);
    if (!rl.success) {
      return privateJson(context, { error: copy.rate }, { status: 429 });
    }

    const body = await readBoundedJson(request);
    const parsed = createReportSchema.safeParse(body);

    if (!parsed.success) {
      return privateJson(
        context,
        { error: copy.validationFailed, details: parsed.error.format() },
        { status: 400 },
      );
    }

    if (parsed.data.targetType === "user" && parsed.data.targetId === user.id) {
      return privateJson(context, { error: copy.cannotReportSelf }, { status: 422 });
    }

    const reportId = generateId("rpt");
    const result = await platformReportService.createWithAudit(
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
        { error: copy.alreadyOpen, reportId: result.report.id },
        { status: 409 },
      );
    }
    const report = result.report;

    return privateJson(context, { success: true, report }, { status: 201 });
  } catch (error: unknown) {
    if (isPostgresDeadlock(error))
      return privateJson(context, { code: "REPORT_RETRY", error: copy.retry }, { status: 409 });
    if (
      error instanceof AppError &&
      [
        "UNSUPPORTED_MEDIA_TYPE",
        "INVALID_BODY_LENGTH",
        "REQUEST_BODY_TOO_LARGE",
        "REQUEST_BODY_TIMEOUT",
        "UNAUTHORIZED",
        "FORBIDDEN",
        "NOT_FOUND",
        "REPORT_OWN_TARGET",
      ].includes(error.code)
    ) {
      return privateJson(
        context,
        {
          error: localeAppErrorText(
            error,
            {
              unauthorized: copy.authenticationRequired,
              forbidden: copy.forbidden,
              notFound: copy.notFound,
              unsupportedMediaType: copy.unsupportedMediaType,
              requestBodyTooLarge: copy.requestBodyTooLarge,
              invalidBodyLength: copy.invalidBodyLength,
              requestBodyTimeout: copy.requestBodyTimeout,
              failed: copy.submitFailed,
            },
            { REPORT_OWN_TARGET: copy.cannotReportSelf },
          ),
          code: error.code,
        },
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
    return privateJson(context, { error: copy.submitFailed }, { status: 500 });
  }
});
