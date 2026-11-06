import { AppError } from "@nexus/domain";
import { can } from "@nexus/security";
import { ErrorState } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  communityReportDetailSchema,
  communityReportPageQuery,
  communityReportPageSchema,
} from "../lib/community-report-contract";
import { communityReportCopy } from "../lib/community-report-copy";
import { reportGroupsCopy } from "../lib/community-report-groups-copy";
import { getDictionary } from "../lib/i18n";
import { getRequestLocale } from "../lib/i18n-server";
import { authService } from "../lib/services/auth-service";
import { communityReportService } from "../lib/services/community-report-service";
import { CommunityReportDetailView } from "./community-report-detail";
import { CommunityReportList } from "./community-report-list";
import { PlatformSignIn } from "./platform-sign-in";
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
  const actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  const base = staff ? "/admin/reports" : "/workspace/reports";
  const listParams = new URLSearchParams();
  if (!id) {
    for (const [key, value] of Object.entries((await searchParams) ?? {})) {
      if (Array.isArray(value)) for (const item of value) listParams.append(key, item);
      else if (value !== undefined) listParams.append(key, value);
    }
  }
  const loginReturn = id
    ? `${base}/${encodeURIComponent(id)}`
    : listParams.size
      ? `${base}?${listParams}`
      : base;
  if (!actor) {
    return <PlatformSignIn locale={locale} returnPath={loginReturn} />;
  }
  if (staff && !can(actor, "admin.moderation")) {
    return (
      <div className="mx-auto min-w-0 max-w-5xl overflow-x-clip">
        <ErrorState
          id="community-report-forbidden"
          title={copy.forbidden}
          action={
            <Link
              href="/admin"
              className="inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {dictionary.admin.title}
            </Link>
          }
        />
      </div>
    );
  }
  const title = id ? copy.detail : staff ? copy.queue : copy.title;
  const header = (
    <header className="min-w-0 space-y-2">
      <h1 className="text-2xl font-bold text-primary">{title}</h1>
      <p className="text-sm text-muted">{staff ? copy.queueDescription : copy.description}</p>
      {staff && !id && (
        <Link
          href="/admin/reports/targets"
          className="inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
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
      <div className="min-w-0 space-y-6 overflow-x-clip">
        {header}
        <CommunityReportDetailView
          key={`${actor.id}:${id}:${staff}`}
          id={id}
          initial={initial}
          locale={locale}
          staff={staff}
        />
      </div>
    );
  }
  const filters = communityReportPageQuery(await searchParams);
  if (!filters)
    return (
      <div className="min-w-0 space-y-4 overflow-x-clip">
        {header}
        <ErrorState
          title={copy.queryInvalid}
          action={
            <Link
              href={base}
              className="inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
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
    <div className="min-w-0 space-y-6 overflow-x-clip">
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
