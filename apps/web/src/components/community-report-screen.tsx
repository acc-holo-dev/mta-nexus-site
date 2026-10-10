import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { can } from "@nexus/security";
import { AppError } from "@nexus/domain";
import { authService } from "../lib/services/auth-service";
import { communityReportService } from "../lib/services/community-report-service";
import { getRequestLocale } from "../lib/i18n-server";
import { communityReportCopy } from "../lib/community-report-copy";
import {
  communityReportPageQuery,
  communityReportPageSchema,
  communityReportDetailSchema,
} from "../lib/community-report-contract";
import { CommunityReportList } from "./community-report-list";
import { CommunityReportDetailView } from "./community-report-detail";
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
