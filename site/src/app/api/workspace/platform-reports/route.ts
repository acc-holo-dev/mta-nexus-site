import type { NextRequest } from "next/server";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
} from "../../../../lib/observability";
import { authService } from "../../../../lib/services/auth-service";
import { platformReportService } from "../../../../lib/services/platform-report-service";

const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function GET(request: NextRequest) {
  const context = createRequestLogContext(request);
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);
    if (!user) {
      return jsonWithRequestId(
        context,
        { error: "Unauthorized" },
        { status: 401, headers: privateHeaders },
      );
    }
    const rawPage = request.nextUrl.searchParams.get("page") ?? "1";
    if (!/^[1-9]\d{0,4}$/.test(rawPage)) {
      return jsonWithRequestId(
        context,
        { error: "Invalid page" },
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
      { error: "Failed to load platform reports" },
      { status: 500, headers: privateHeaders },
    );
  }
}
