import type { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
import { resourceCommerceRequest } from "./resource-commerce-http";
import { resourceBuildWorkspaceService } from "./services/resource-build-workspace-service";
export function buildPackageReportRequest(
  request: NextRequest,
  params: Promise<{ id: string; buildId: string }>,
  staff = false,
) {
  return resourceCommerceRequest(request, false, async (actor) => {
    const { id, buildId } = await params;
    const { build } = await resourceBuildWorkspaceService.detail(id, buildId, actor, staff);
    if (!build.packageEvidence)
      throw new AppError("No recorded package evidence", 404, "BUILD_PACKAGE_EVIDENCE_MISSING");
    return new Response(
      JSON.stringify(
        { buildId: build.id, version: build.version, evidence: build.packageEvidence },
        null,
        2,
      ),
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": 'attachment; filename="nexus-package-report.json"',
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  });
}
