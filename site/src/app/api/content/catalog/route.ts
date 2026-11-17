import type { NextRequest } from "next/server";
import { parseContentPage } from "../../../../features/community/user-platform-contract";
import { userPlatformError } from "../../../../features/community/user-platform-copy";
import { resolveLocale } from "../../../../lib/i18n";
import { contentService } from "../../../../lib/services/content-service";
export async function GET(request: NextRequest) {
  const filters = parseContentPage(request.nextUrl.searchParams);
  try {
    const result =
      request.nextUrl.searchParams.get("channel") === "community"
        ? await contentService.pageCommunity(filters)
        : await contentService.pageArticles(filters);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json(
      { error: userPlatformError(resolveLocale(request.cookies.get("nexus_locale")?.value), null) },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
