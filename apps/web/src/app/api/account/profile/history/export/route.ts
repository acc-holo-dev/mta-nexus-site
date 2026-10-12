import type { NextRequest } from "next/server";
import { resolveLocale } from "../../../../../../lib/i18n";
import { privateChangeHistoryCopy } from "../../../../../../lib/private-change-history-copy";
import { privateChangeHistoryDownload } from "../../../../../../lib/private-change-history-download";
import { GET as read } from "../route";
export async function GET(request: NextRequest) {
  return privateChangeHistoryDownload(
    await read(request),
    "profile-history.json",
    privateChangeHistoryCopy(resolveLocale(request.cookies.get("nexus_locale")?.value)).unavailable,
  );
}
