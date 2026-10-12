import type { NextRequest } from "next/server";
import { resolveLocale } from "../../../../../../../lib/i18n";
import { organizationGovernanceCopy } from "../../../../../../../lib/organization-governance-copy";
import { privateChangeHistoryDownload } from "../../../../../../../lib/private-change-history-download";
import { GET as read } from "../route";
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return privateChangeHistoryDownload(
    await read(request, context),
    "organization-activity.json",
    organizationGovernanceCopy(resolveLocale(request.cookies.get("nexus_locale")?.value))
      .unavailable,
  );
}
