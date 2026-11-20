import type { NextRequest } from "next/server";
import { reportHistoryExport } from "../../../../../../../features/community/community-report-history-http";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return reportHistoryExport(request, params, true);
}
