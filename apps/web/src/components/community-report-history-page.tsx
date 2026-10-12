import { AppError } from "@nexus/domain";
import { cookies } from "next/headers";
import Link from "next/link";
import { reportId, reportRateLimit } from "../lib/community-report-api";
import { parseReportHistoryQuery } from "../lib/community-report-history-contract";
import { reportHistoryCopy, reportHistoryError } from "../lib/community-report-history-copy";
import { getRequestLocale } from "../lib/i18n-server";
import { authService } from "../lib/services/auth-service";
import { communityReportHistoryService } from "../lib/services/community-report-history-service";
import { CommunityReportHistory } from "./community-report-history";
import { PlatformSignIn } from "./content-catalog-controls";
export async function reportHistoryMetadata() {
  return {
    title: reportHistoryCopy(await getRequestLocale()).title,
    robots: { index: false, follow: false },
  };
}
export async function CommunityReportHistoryPage({
  id,
  staff = false,
  searchParams,
}: {
  id: string;
  staff?: boolean;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale(),
    copy = reportHistoryCopy(locale),
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  if (!actor) return <PlatformSignIn locale={locale} />;
  const path = `${staff ? "/admin/reports" : "/workspace/reports"}/${encodeURIComponent(id)}/history`;
  try {
    reportId(id);
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(await searchParams)) {
      if (Array.isArray(value)) for (const item of value) query.append(key, item);
      else if (value !== undefined) query.append(key, value);
    }
    const filters = parseReportHistoryQuery(query);
    if (!filters)
      throw new AppError("Invalid report history filters", 400, "CHANGE_HISTORY_FILTER_INVALID");
    await reportRateLimit(actor.id, "search");
    return (
      <CommunityReportHistory
        page={await communityReportHistoryService.page(actor, id, filters, staff)}
        filters={filters}
        locale={locale}
      />
    );
  } catch (error) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <p role="alert" className="nexus-panel p-5 text-danger">
          {reportHistoryError(locale, error instanceof AppError ? error.code : "INTERNAL_ERROR")}
        </p>
        <Link
          href={path}
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
        >
          {copy.reset}
        </Link>
      </div>
    );
  }
}
