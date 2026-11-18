import type { NextRequest } from "next/server";
import { platformReportsApiCopy } from "../../../../features/moderation/platform-reports-api-copy";
import { resolveLocale } from "../../../../lib/i18n";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
} from "../../../../lib/platform/observability";
import { authService } from "../../../../lib/services/accounts/auth-service";
import { platformReportService } from "../../../../lib/services/moderation/platform-report-service";

const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function GET(request: NextRequest) {
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
    const rawPage = request.nextUrl.searchParams.get("page") ?? "1";
    if (!/^[1-9]\d{0,4}$/.test(rawPage)) {
      return jsonWithRequestId(
        context,
        { error: copy.invalidPage },
        { status: 400, headers: privateHeaders },
      );
    }
    const page = Number(rawPage);
    const result = await platformReportService.listForReporter(user, page);
    return jsonWithRequestId(context, result, { headers: privateHeaders });
  } catch (error: unknown) {
    logRequestEvent({
      level: "error",
      event: "platform_report.list_failed",
      context,
      status: 500,
      error,
    });
    return jsonWithRequestId(
      context,
      { error: copy.listFailed },
      { status: 500, headers: privateHeaders },
    );
  }
}
