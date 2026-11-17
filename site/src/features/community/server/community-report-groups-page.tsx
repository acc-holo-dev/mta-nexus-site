import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { getRequestLocale } from "../../../lib/i18n-server";
import { authService } from "../../../lib/services/auth-service";
import { communityReportGroupsService } from "../../../lib/services/community-report-groups-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { PlatformSessionError } from "../../shell/session-error";
import { reportRateLimit } from "../community-report-api";
import { parseReportGroupsQuery } from "../community-report-groups-contract";
import { reportGroupsCopy, reportGroupsError } from "../community-report-groups-copy";
import { CommunityReportGroups } from "../components/community-report-groups";
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
    copy = reportGroupsCopy(locale);
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value)) for (const item of value) query.append(key, item);
    else if (value !== undefined) query.append(key, value);
  }
  const path = "/admin/reports/targets";
  const returnPath = query.size ? `${path}?${query}` : path;
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={copy.title}
        message={copy.unavailable}
        retryHref={returnPath}
      />
    );
  }
  if (!actor) return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  try {
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
        <h1 className="font-display text-primary">{copy.title}</h1>
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
