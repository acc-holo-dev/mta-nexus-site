import type { NextRequest } from "next/server";
import { contentService } from "../../../../lib/services/content-service";
import { parseContentPage } from "../../../../lib/user-platform-contract";
import { resolveLocale } from "../../../../lib/i18n";
import { userPlatformError } from "../../../../lib/user-platform-copy";
export async function GET(request: NextRequest) {
  const filters = parseContentPage(request.nextUrl.searchParams);
  try {
    const result =
      request.nextUrl.searchParams.get("channel") === "community"
        ? await contentService.pageCommunity(filters)
        : await contentService.pageArticles(filters);
    return Response.json(result, { headers: { "Cache-Control": "public, max-age=30" } });
  } catch {
    return Response.json(
      { error: userPlatformError(resolveLocale(request.cookies.get("nexus_locale")?.value), null) },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
