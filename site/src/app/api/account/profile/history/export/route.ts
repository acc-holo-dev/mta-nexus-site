import type { NextRequest } from "next/server";
import { privateChangeHistoryCopy } from "../../../../../../features/accounts/private-change-history-copy";
import { privateChangeHistoryDownload } from "../../../../../../features/accounts/private-change-history-download";
import { resolveLocale } from "../../../../../../lib/i18n";
import { GET as read } from "../route";
export async function GET(request: NextRequest) {
  return privateChangeHistoryDownload(
    await read(request),
    "profile-history.json",
    privateChangeHistoryCopy(resolveLocale(request.cookies.get("nexus_locale")?.value)).unavailable,
  );
}
