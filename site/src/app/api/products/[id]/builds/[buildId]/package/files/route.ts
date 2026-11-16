import type { NextRequest } from "next/server";
import { buildPackageFilesRequest } from "../../../../../../../../lib/build-package-files-http";
export function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; buildId: string }> },
) {
  return buildPackageFilesRequest(request, params);
}
