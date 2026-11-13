import type { NextRequest } from "next/server";
import { resolveLocale } from "../../../../../../lib/i18n";
import { privateChangeHistoryDownload } from "../../../../../../lib/private-change-history-download";
import { supportMessageCopy } from "../../../../../../lib/support-message-discovery-copy";
import { GET as read } from "../route";
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return privateChangeHistoryDownload(
    await read(request, context),
    "support-messages.json",
    supportMessageCopy(resolveLocale(request.cookies.get("nexus_locale")?.value)).unavailable,
  );
}
