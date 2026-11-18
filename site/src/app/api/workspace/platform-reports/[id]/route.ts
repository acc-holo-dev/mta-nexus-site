import type { NextRequest } from "next/server";
import { platformReportsApiCopy } from "../../../../../features/moderation/platform-reports-api-copy";
import { resolveLocale } from "../../../../../lib/i18n";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
} from "../../../../../lib/platform/observability";
import { authService } from "../../../../../lib/services/accounts/auth-service";
import { platformReportService } from "../../../../../lib/services/moderation/platform-report-service";

const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = createRequestLogContext(request);
  const copy = platformReportsApiCopy(resolveLocale(request.cookies.get("nexus_locale")?.value));
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);
    if (!user) {
      return jsonWithRequestId(
        context,
        { error: copy.unauthorized },
        { status: 401, headers: privateHeaders },
      );
    }
    const { id } = await params;
    const report = await platformReportService.detailForReporter(user, id);
    if (!report) {
      return jsonWithRequestId(
        context,
        { error: copy.notFound },
        { status: 404, headers: privateHeaders },
      );
    }
    return jsonWithRequestId(context, { report }, { headers: privateHeaders });
  } catch (error: unknown) {
    logRequestEvent({
      level: "error",
      event: "platform_report.detail_failed",
      context,
      status: 500,
      error,
    });
    return jsonWithRequestId(
      context,
      { error: copy.detailFailed },
      { status: 500, headers: privateHeaders },
    );
  }
}
