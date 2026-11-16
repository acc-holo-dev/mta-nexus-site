import type { NextRequest } from "next/server";
import { reportHistoryExport } from "../../../../../../../lib/community-report-history-http";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return reportHistoryExport(request, params, false);
}
