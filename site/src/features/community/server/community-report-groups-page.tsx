import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { reportRateLimit } from "../../../lib/community-report-api";
import { parseReportGroupsQuery } from "../../../lib/community-report-groups-contract";
import { reportGroupsCopy, reportGroupsError } from "../../../lib/community-report-groups-copy";
import { getRequestLocale } from "../../../lib/i18n-server";
import { authService } from "../../../lib/services/auth-service";
import { communityReportGroupsService } from "../../../lib/services/community-report-groups-service";
import { CommunityReportGroups } from "../components/community-report-groups";
import { PlatformSignIn } from "../../../components/platform-sign-in";
export async function reportGroupsMetadata() {
  return {
    title: reportGroupsCopy(await getRequestLocale()).title,
    robots: { index: false, follow: false },
  };
}
export async function CommunityReportGroupsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale(),
    copy = reportGroupsCopy(locale),
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  if (!actor) return <PlatformSignIn locale={locale} returnPath="/admin/reports/targets" />;
  try {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(await searchParams)) {
      if (Array.isArray(value)) for (const item of value) query.append(key, item);
      else if (value !== undefined) query.append(key, value);
    }
    const filters = parseReportGroupsQuery(query);
    if (!filters) throw new AppError("Invalid groups", 400, "CHANGE_HISTORY_FILTER_INVALID");
    await reportRateLimit(actor.id, "search");
    return (
      <CommunityReportGroups
        page={await communityReportGroupsService.page(actor, filters)}
        filters={filters}
        locale={locale}
      />
    );
  } catch (error) {
    return (
      <div className="mx-auto min-w-0 max-w-5xl space-y-4 overflow-x-clip">
        <ErrorState
          title={reportGroupsError(
            locale,
            error instanceof AppError ? error.code : "INTERNAL_ERROR",
          )}
          action={
            <Link
              href="/admin/reports/targets"
              className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {copy.reset}
            </Link>
          }
        />
      </div>
    );
  }
}
