import type { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { resourceReleaseWatchesQuery } from "../../../../../lib/resource-release-watches-query";
import { resourceReleaseWatchesService } from "../../../../../lib/services/resource-release-watches-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, async (actor) => {
    const query = resourceReleaseWatchesQuery(request.nextUrl.searchParams);
    const result = await resourceReleaseWatchesService.page(
      actor,
      query.page,
      query.filter,
      query.query,
    );
    const json = JSON.stringify(
      {
        schemaVersion: 1,
        query,
        items: result.items.map(
          ({ productId, enabled, revision, updatedAt, available, title }) => ({
            productId,
            enabled,
            revision,
            updatedAt,
            available,
            title: available ? title : null,
          }),
        ),
        counts: {
          all: result.counts.all,
          enabled: result.counts.enabled,
          disabled: result.counts.disabled,
          unavailable: result.counts.unavailable,
        },
        page: result.page,
        totalPages: result.totalPages,
        pageSize: result.pageSize,
        total: result.total,
      },
      null,
      2,
    );
    if (Buffer.byteLength(json) > 512 * 1024)
      throw new AppError("Watch export too large", 413, "RELEASE_WATCH_EXPORT_TOO_LARGE");
    return new Response(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": "attachment; filename=resource-release-watches.json",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
