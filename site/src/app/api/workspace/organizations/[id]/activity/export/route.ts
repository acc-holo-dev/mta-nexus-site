import type { NextRequest } from "next/server";
import { privateChangeHistoryDownload } from "../../../../../../../features/accounts/private-change-history-download";
import { organizationGovernanceCopy } from "../../../../../../../features/organizations/organization-governance-copy";
import { resolveLocale } from "../../../../../../../lib/platform/i18n";
import { GET as read } from "../route";
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return privateChangeHistoryDownload(
    await read(request, context),
    "organization-activity.json",
    organizationGovernanceCopy(resolveLocale(request.cookies.get("nexus_locale")?.value))
      .unavailable,
  );
}
