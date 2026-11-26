import { AppError } from "@nexus/domain";
import { can } from "@nexus/security";
import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { communityReportService } from "../../../lib/services/community/community-report-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSmRounded } from "../../shell/link-shell";
import { pageShellMax5xlBare, pageShellStack4, pageShellStack6 } from "../../shell/page-shell";
import { PlatformSessionError } from "../../shell/session-error";
import {
  type2xlBoldPrimary,
  typeDisplayPrimary,
  typeMinSpace2,
  typeSmMuted,
} from "../../shell/type-shell";
import {
  communityReportDetailHref,
  communityReportDetailSchema,
  communityReportListHref,
  communityReportPageQuery,
  communityReportPageSchema,
} from "../community-report-contract";
import { communityReportCopy } from "../community-report-copy";
import { reportGroupsCopy } from "../community-report-groups-copy";
import { CommunityReportDetailView } from "../components/community-report-detail";
import { CommunityReportList } from "../components/community-report-list";
export async function communityReportMetadata(): Promise<Metadata> {
  return {
    title: communityReportCopy(await getRequestLocale()).detail,
    robots: { index: false, follow: false },
  };
}

export async function communityReportListMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const typedLocale: "en" | "ru" = locale === "ru" ? "ru" : "en";
  return {
    title: communityReportCopy(typedLocale).title,
    robots: { index: false, follow: false },
  };
}

export async function CommunityReportScreen({
  staff = false,
  id,
  searchParams,
}: {
  staff?: boolean;
  id?: string;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale(),
    copy = communityReportCopy(locale),
    dictionary = getDictionary(locale);
  const base = staff ? "/admin/reports" : "/workspace/reports";
  const rawSearch = (await searchParams) ?? {};
  const queueFilters = communityReportPageQuery(rawSearch);
  const queueHref = queueFilters ? communityReportListHref(base, queueFilters) : base;
  const loginReturn = id
    ? queueFilters
      ? communityReportDetailHref(base, id, queueFilters)
      : `${base}/${encodeURIComponent(id)}`
    : queueHref;
  const title = id ? copy.detail : staff ? copy.queue : copy.title;
  const safeReturn = id && !/^[a-zA-Z0-9_-]{1,128}$/u.test(id) ? base : loginReturn;
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={title}
        message={copy.unavailable}
        retryHref={safeReturn}
      />
    );
  }
  if (!actor) {
    return <PlatformSignIn locale={locale} returnPath={safeReturn} />;
  }
  if (staff && !can(actor, "admin.moderation")) {
    return (
      <div className={pageShellMax5xlBare}>
        <h1 className={typeDisplayPrimary}>{title}</h1>
        <ErrorState
          title={copy.forbidden}
          description={copy.forbiddenHint}
          action={
            <Link href="/admin" className={linkAccentSmRounded}>
              {dictionary.admin.title}
            </Link>
          }
        />
      </div>
    );
  }
  const header = (
    <header className={typeMinSpace2}>
      <h1 className={type2xlBoldPrimary}>{title}</h1>
      <p className={typeSmMuted}>{staff ? copy.queueDescription : copy.description}</p>
      {staff && !id && (
        <Link href="/admin/reports/targets" className={linkAccentSmRounded}>
          {reportGroupsCopy(locale).open}
        </Link>
      )}
    </header>
  );
  if (id) {
    let initial = null;
    try {
      initial = communityReportDetailSchema.parse(
        await communityReportService.detail(actor, id, staff),
      );
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 404) notFound();
    }
    return (
      <div className={pageShellStack6}>
        {header}
        <CommunityReportDetailView
          key={`${actor.id}:${id}:${staff}`}
          id={id}
          initial={initial}
          locale={locale}
          staff={staff}
          queueHref={queueHref}
        />
      </div>
    );
  }
  const filters = queueFilters;
  if (!filters)
    return (
      <div className={pageShellStack4}>
        {header}
        <ErrorState
          title={copy.queryInvalid}
          description={copy.queryInvalidHint}
          action={
            <Link href={base} className={linkAccentSmRounded}>
              {copy.reset}
            </Link>
          }
        />
      </div>
    );
  const initial = await communityReportService
    .page(actor, filters, staff)
    .then((value) => communityReportPageSchema.parse(value))
    .catch(() => null);
  return (
    <div className={pageShellStack6}>
      {header}
      <CommunityReportList
        key={`${actor.id}:${staff}:${JSON.stringify(filters)}`}
        initial={initial}
        filters={filters}
        locale={locale}
        staff={staff}
      />
    </div>
  );
}

export function WorkspaceCommunityReportsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return CommunityReportScreen({ searchParams });
}

export function StaffCommunityReportsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return CommunityReportScreen({ staff: true, searchParams });
}

export async function WorkspaceCommunityReportDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return CommunityReportScreen({ id: (await params).id, searchParams });
}

export async function StaffCommunityReportDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return CommunityReportScreen({ staff: true, id: (await params).id, searchParams });
}
