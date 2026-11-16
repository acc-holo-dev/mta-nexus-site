import type { NextRequest } from "next/server";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
} from "../../../../../lib/observability";
import { authService } from "../../../../../lib/services/auth-service";
import { platformReportService } from "../../../../../lib/services/platform-report-service";

const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const { id } = await params;
    const report = await platformReportService.detailForReporter(user, id);
    if (!report) {
      return jsonWithRequestId(
        context,
        { error: "Not found" },
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
      { error: "Failed to load platform report" },
      { status: 500, headers: privateHeaders },
    );
  }
}
