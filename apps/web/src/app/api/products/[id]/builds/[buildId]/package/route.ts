import type { NextRequest } from "next/server";
import { buildPackageReportRequest } from "../../../../../../../lib/build-package-report-http";
export function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; buildId: string }> },
) {
  return buildPackageReportRequest(request, params);
}
