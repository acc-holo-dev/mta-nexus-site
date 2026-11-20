import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { communityReportHistoryService } from "../../../lib/services/community/community-report-history-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSm } from "../../shell/link-shell";
import { pageShellMax4xlDenseTight } from "../../shell/page-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { typeDisplayPrimary } from "../../shell/type-shell";
import { reportId, reportRateLimit } from "../community-report-api";
import { parseReportHistoryQuery } from "../community-report-history-contract";
import { reportHistoryCopy, reportHistoryError } from "../community-report-history-copy";
import { CommunityReportHistory } from "../components/community-report-history";
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
    copy = reportHistoryCopy(locale);
  const path = `${staff ? "/admin/reports" : "/workspace/reports"}/${encodeURIComponent(id)}/history`;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value)) for (const item of value) query.append(key, item);
    else if (value !== undefined) query.append(key, value);
  }
  const safePath = /^[a-zA-Z0-9_-]{1,128}$/u.test(id)
    ? path
    : staff
      ? "/admin/reports"
      : "/workspace/reports";
  const returnPath = safePath === path && query.size ? `${path}?${query}` : safePath;
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
    reportId(id);
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
      <div className={pageShellMax4xlDenseTight}>
        <h1 className={typeDisplayPrimary}>{copy.title}</h1>
        <ErrorState
          title={reportHistoryError(
            locale,
            error instanceof AppError ? error.code : "INTERNAL_ERROR",
          )}
          description={copy.unavailableHint}
          action={
            <Link href={path} className={linkAccentSm}>
              {copy.reset}
            </Link>
          }
        />
      </div>
    );
  }
}

export async function WorkspaceCommunityReportHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return CommunityReportHistoryPage({ id: (await params).id, searchParams });
}

export async function StaffCommunityReportHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return CommunityReportHistoryPage({ id: (await params).id, searchParams, staff: true });
}
