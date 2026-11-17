import type { NextRequest } from "next/server";
import { reportHistoryRead } from "../../../../../../features/community/community-report-history-http";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return reportHistoryRead(request, params, false);
}
