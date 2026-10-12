import { AppError } from "@nexus/domain";
import { can } from "@nexus/security";
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
import { getRequestLocale } from "../lib/i18n-server";
import { authService } from "../lib/services/auth-service";
import { communityReportService } from "../lib/services/community-report-service";
import { CommunityReportDetailView } from "./community-report-detail";
import { CommunityReportList } from "./community-report-list";
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
    copy = communityReportCopy(locale);
  const actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  if (!actor || (staff && !can(actor, "admin.moderation")))
    return (
      <div className="nexus-panel space-y-3 p-8">
        <h1 className="text-xl font-semibold text-primary">
          {staff ? copy.forbidden : copy.title}
        </h1>
        <Link className="text-sm text-accent underline" href="/auth/login">
          {copy.signIn}
        </Link>
      </div>
    );
  const title = id ? copy.detail : staff ? copy.queue : copy.title;
  const header = (
    <header>
      <h1 className="text-2xl font-bold text-primary">{title}</h1>
      <p className="mt-2 text-sm text-muted">{staff ? copy.queueDescription : copy.description}</p>
      {staff && !id && (
        <Link
          href="/admin/reports/targets"
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
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
      <div className="space-y-6">
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
      <div className="space-y-4">
        {header}
        <p role="alert" className="nexus-panel p-5 text-danger">
          {copy.queryInvalid}
        </p>
        <Link
          href={staff ? "/admin/reports" : "/workspace/reports"}
          className="text-accent underline"
        >
          {copy.reset}
        </Link>
      </div>
    );
  const initial = await communityReportService
    .page(actor, filters, staff)
    .then((value) => communityReportPageSchema.parse(value))
    .catch(() => null);
  return (
    <div className="space-y-6">
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
