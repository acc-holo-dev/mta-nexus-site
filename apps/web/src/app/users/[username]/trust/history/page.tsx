import { AppError } from "@nexus/domain";
import { Button, EmptyState, ErrorState, fieldClass } from "@nexus/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../../../lib/i18n";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import {
  approvalPageHref,
  parseApprovalQuery,
} from "../../../../../lib/public-verification-history-contract";
import { approvalCopy, approvalError } from "../../../../../lib/public-verification-history-copy";
import { publicVerificationHistoryService } from "../../../../../lib/services/public-verification-history-service";
export const dynamic = "force-dynamic";
const pageShellClass = "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip";
const actionLinkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";
export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const copy = approvalCopy(await getRequestLocale()),
    { username } = await params;
  return {
    title: copy.title,
    description: copy.description,
    alternates: { canonical: approvalPageHref(username) },
  };
}
export default async function ApprovalHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { username } = await params,
    locale = await getRequestLocale(),
    copy = approvalCopy(locale),
    dictionary = getDictionary(locale),
    query = new URLSearchParams();
  for (const [key, value] of Object.entries((await searchParams) ?? {})) {
    if (Array.isArray(value)) for (const part of value) query.append(key, part);
    else if (value !== undefined) query.append(key, value);
  }
  const filters = parseApprovalQuery(query),
    latest = approvalPageHref(username, filters ?? {}),
    filtered = Boolean(filters?.type);
  let error = filters ? "" : copy.invalid;
  const page = filters
    ? await publicVerificationHistoryService.page(username, filters).catch((failure: unknown) => {
        if (failure instanceof AppError && failure.code === "NOT_FOUND") notFound();
        error = approvalError(
          locale,
          failure instanceof AppError ? failure.code : "INTERNAL_ERROR",
        );
        return null;
      })
    : null;
  return (
    <div className={pageShellClass}>
      <Link href={`/users/${encodeURIComponent(username)}/trust`} className={actionLinkClass}>
        {copy.back}
      </Link>
      <header className="nexus-panel min-w-0 space-y-3 overflow-x-clip p-6">
        <h1 className="text-2xl font-extrabold text-primary">{copy.title}</h1>
        {page && (
          <p className="break-words font-semibold text-primary">
            {page.subject.name} (@{page.subject.username})
          </p>
        )}
        <p className="text-sm text-muted">{copy.description}</p>
        <p className="text-sm text-secondary">{copy.scope}</p>
      </header>
      {page && (
        <section className="nexus-panel min-w-0 space-y-3 overflow-x-clip p-5">
          <h2 className="font-heading text-primary">{copy.current}</h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted">{copy.user}</dt>
              <dd
                className={`text-sm font-semibold ${page.subject.identityVerified ? "text-success" : "text-muted"}`}
              >
                {page.subject.identityVerified ? copy.verified : copy.unverified}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">{copy.developer}</dt>
              <dd
                className={`text-sm font-semibold ${page.subject.developerVerified ? "text-success" : "text-muted"}`}
              >
                {page.subject.developerVerified ? copy.verified : copy.unverified}
              </dd>
            </div>
          </dl>
        </section>
      )}
      <form
        action={approvalPageHref(username)}
        method="get"
        className="nexus-panel flex min-w-0 flex-wrap items-end gap-3 overflow-x-clip p-4"
      >
        <label className="space-y-1 text-xs text-muted">
          {copy.type}
          <select
            name="type"
            defaultValue={filters?.type ?? ""}
            className={`${fieldClass} block min-h-11`}
          >
            <option value="">{copy.all}</option>
            <option value="user">{copy.user}</option>
            <option value="developer">{copy.developer}</option>
          </select>
        </label>
        <Button type="submit" className="min-h-11 font-semibold">
          {copy.filter}
        </Button>
        <Link href={approvalPageHref(username)} className={actionLinkClass}>
          {copy.reset}
        </Link>
      </form>
      <a href={latest} className={actionLinkClass}>
        {copy.latest}
      </a>
      {error && (
        <ErrorState
          title={error}
          action={
            <a href={latest} className={actionLinkClass}>
              {dictionary.errors.retry}
            </a>
          }
        />
      )}
      {page && !page.items.length && (
        <EmptyState
          title={filtered ? copy.emptyFiltered : copy.empty}
          description={filtered ? copy.emptyFilteredHint : copy.emptyHint}
          action={
            filtered ? (
              <Link href={approvalPageHref(username)} className={actionLinkClass}>
                {copy.reset}
              </Link>
            ) : undefined
          }
        />
      )}
      {page && (
        <ol className="min-w-0 space-y-3 overflow-x-clip">
          {page.items.map((record) => (
            <li key={record.key} className="nexus-panel min-w-0 space-y-2 overflow-x-clip p-5">
              <h2 className="font-semibold text-primary">{copy[record.type]}</h2>
              <p className="text-sm text-secondary">{copy.approved}</p>
              <time dateTime={record.approvedAt} className="text-sm text-muted">
                {new Date(record.approvedAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
                  timeZone: "UTC",
                  timeZoneName: "short",
                })}
              </time>
            </li>
          ))}
        </ol>
      )}
      {page?.nextCursor && filters && (
        <Link
          prefetch={false}
          href={approvalPageHref(username, filters, page.nextCursor)}
          className="inline-flex min-h-11 items-center rounded-lg border border-base px-4 text-sm text-secondary"
        >
          {copy.older}
        </Link>
      )}
    </div>
  );
}
