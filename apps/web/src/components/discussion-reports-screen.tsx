import { AppError } from "@nexus/domain";
import { can } from "@nexus/security";
import { Button } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { moderationCopy } from "../lib/community-moderation-copy";
import { REPORT_TYPES } from "../lib/community-report-contract";
import { communityReportCopy } from "../lib/community-report-copy";
import {
  discussionReportsHref,
  discussionReportsPageSchema,
  parseDiscussionReportsQuery,
} from "../lib/discussion-reports-contract";
import { discussionReportsCopy } from "../lib/discussion-reports-copy";
import { getRequestLocale } from "../lib/i18n-server";
import { moderatedDiscussionHref } from "../lib/moderated-discussion-contract";
import { moderatedDiscussionError } from "../lib/moderated-discussion-copy";
import { authService } from "../lib/services/auth-service";
import { communityModerationService } from "../lib/services/community-moderation-service";
import { platformFieldClass } from "../lib/user-platform-client";
import { DiscussionReportBatch } from "./discussion-report-batch";
export async function DiscussionReportsScreen({
  id,
  commentId,
  searchParams,
}: {
  id: string;
  commentId: string;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale(),
    copy = discussionReportsCopy(locale),
    general = moderationCopy(locale),
    labels = communityReportCopy(locale),
    path = discussionReportsHref(id, commentId);
  let failure = "";
  const actor = await authService
    .getSession((await cookies()).get("nexus_session")?.value)
    .catch(() => {
      failure = general.unavailable;
      return null;
    });
  if (!actor || !can(actor, "admin.moderation"))
    return (
      <section className="nexus-panel space-y-3 p-5">
        <h1 className="text-xl font-bold text-primary">{copy.title}</h1>
        <p role="alert" className="text-danger">
          {failure || general.denied}
        </p>
        {!actor && !failure && (
          <Link
            href="/auth/login"
            className="inline-flex min-h-11 items-center text-accent underline"
          >
            {general.signIn}
          </Link>
        )}
      </section>
    );
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries((await searchParams) ?? {}))
    if (value !== undefined)
      for (const item of Array.isArray(value) ? value : [value]) params.append(key, item);
  const filters = parseDiscussionReportsQuery(params);
  if (!filters) failure = general.invalid;
  const raw = filters
    ? await communityModerationService
        .discussionReports(actor, id, commentId, filters)
        .catch((error: unknown) => {
          if (error instanceof AppError && error.statusCode === 404) notFound();
          failure = moderatedDiscussionError(
            locale,
            error instanceof AppError ? error.code : "INTERNAL_ERROR",
          );
          return null;
        })
    : null;
  const parsed = discussionReportsPageSchema.safeParse(raw);
  if (!parsed.success || parsed.data.publication.id !== id || parsed.data.commentId !== commentId)
    return (
      <section className="nexus-panel space-y-3 p-5">
        <p role="alert" className="text-danger">
          {failure || copy.unavailable}
        </p>
        <a href={path} className="inline-flex min-h-11 items-center text-accent underline">
          {general.reload}
        </a>
      </section>
    );
  const data = parsed.data;
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold text-primary">{copy.title}</h1>
        <p className="text-sm text-muted">{copy.description}</p>
        <p className="break-words text-primary">
          {data.publication.title} · {general[data.publication.status]}
        </p>
        <Link
          href={moderatedDiscussionHref(id, undefined, undefined, commentId)}
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
        >
          {copy.back}
        </Link>
      </header>
      {data.removed && (
        <p role="status" className="nexus-panel p-4 text-sm text-muted">
          {copy.removed}
        </p>
      )}
      <form action={path} className="nexus-panel grid gap-4 p-5 sm:grid-cols-2">
        <label className="space-y-1 text-sm text-primary">
          <span>{copy.search}</span>
          <input
            className={platformFieldClass}
            name="q"
            type="search"
            maxLength={100}
            defaultValue={filters?.query}
          />
        </label>
        <label className="space-y-1 text-sm text-primary">
          <span>{copy.view}</span>
          <select className={platformFieldClass} name="view" defaultValue={filters?.view}>
            <option value="pending">{copy.pending}</option>
            <option value="history">{copy.history}</option>
          </select>
        </label>
        <label className="space-y-1 text-sm text-primary">
          <span>{copy.type}</span>
          <select className={platformFieldClass} name="type" defaultValue={filters?.type ?? ""}>
            <option value="">{copy.all}</option>
            {REPORT_TYPES.map((type) => (
              <option key={type} value={type}>
                {labels[type]}
              </option>
            ))}
          </select>
        </label>
        <Button className="min-h-11 self-end" type="submit">
          {copy.apply}
        </Button>
      </form>
      <DiscussionReportBatch
        key={`${id}:${commentId}:${filters?.query}:${filters?.view}:${filters?.type}:${filters?.cursor?.id}:${data.removed}:${data.items.map((item) => `${item.id}:${item.status}:${item.createdAt}`).join("|")}`}
        contentId={id}
        commentId={commentId}
        items={data.items}
        locale={locale}
        allowActions={filters?.view === "pending"}
      />
      <nav className="flex flex-wrap gap-4" aria-label={copy.title}>
        <Link
          prefetch={false}
          href={discussionReportsHref(id, commentId, filters ?? undefined)}
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
        >
          {general.latest}
        </Link>
        {data.nextCursor && (
          <Link
            prefetch={false}
            href={discussionReportsHref(id, commentId, filters ?? undefined, data.nextCursor)}
            className="inline-flex min-h-11 items-center text-sm text-accent underline"
          >
            {general.older}
          </Link>
        )}
      </nav>
    </div>
  );
}
