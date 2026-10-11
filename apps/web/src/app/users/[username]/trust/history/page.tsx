import Link from "next/link";
import { notFound } from "next/navigation";
import { AppError } from "@nexus/domain";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { publicVerificationHistoryService } from "../../../../../lib/services/public-verification-history-service";
import { approvalCopy, approvalError } from "../../../../../lib/public-verification-history-copy";
import {
  approvalPageHref,
  parseApprovalQuery,
} from "../../../../../lib/public-verification-history-contract";
export const dynamic = "force-dynamic";
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
    query = new URLSearchParams();
  for (const [key, value] of Object.entries((await searchParams) ?? {})) {
    if (Array.isArray(value)) for (const part of value) query.append(key, part);
    else if (value !== undefined) query.append(key, value);
  }
  const filters = parseApprovalQuery(query),
    latest = approvalPageHref(username, filters ?? {});
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
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href={`/users/${encodeURIComponent(username)}/trust`}
        className="inline-flex min-h-11 items-center text-sm text-accent underline"
      >
        {copy.back}
      </Link>
      <header className="nexus-panel space-y-3 p-6">
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
        <section className="nexus-panel space-y-3 p-5">
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
        className="nexus-panel flex flex-wrap items-end gap-3 p-4"
      >
        <label className="space-y-1 text-xs text-muted">
          {copy.type}
          <select
            name="type"
            defaultValue={filters?.type ?? ""}
            className="nexus-input block min-h-11"
          >
            <option value="">{copy.all}</option>
            <option value="user">{copy.user}</option>
            <option value="developer">{copy.developer}</option>
          </select>
        </label>
        <button
          type="submit"
          className="min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-white"
        >
          {copy.filter}
        </button>
        <Link
          href={approvalPageHref(username)}
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
        >
          {copy.reset}
        </Link>
      </form>
      <a href={latest} className="inline-flex min-h-11 items-center text-sm text-accent underline">
        {copy.latest}
      </a>
      {error && (
        <p role="alert" className="nexus-panel p-4 text-sm text-danger">
          {error}
        </p>
      )}
      {page && !page.items.length && (
        <p className="nexus-panel p-6 text-sm text-muted">{copy.empty}</p>
      )}
      {page && (
        <ol className="space-y-3">
          {page.items.map((record) => (
            <li key={record.key} className="nexus-panel space-y-2 p-5">
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
