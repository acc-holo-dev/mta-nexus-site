import { AppError } from "@nexus/domain";
import { Button, EmptyState, ErrorState } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { PlatformSignIn } from "../../../../components/platform-sign-in";
import { getDictionary } from "../../../../lib/i18n";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { authService } from "../../../../lib/services/auth-service";
import { verificationWorkspaceService } from "../../../../lib/services/verification-workspace-service";
import { platformFieldClass } from "../../../../lib/user-platform-client";
import {
  parseVerificationApplicationsQuery,
  verificationApplicationsHref,
} from "../../../../lib/verification-applications-contract";
import {
  verificationApplicationsCopy,
  verificationApplicationsError,
} from "../../../../lib/verification-applications-copy";
import { VERIFICATION_TYPES } from "../../../../lib/verification-workspace-contract";
import { verificationCopy } from "../../../../lib/verification-workspace-copy";

export const dynamic = "force-dynamic";

const pageShellClass = "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export async function generateMetadata() {
  const copy = verificationApplicationsCopy(await getRequestLocale());
  return {
    title: copy.title,
    description: copy.description,
    robots: { index: false, follow: false },
  };
}

export default async function VerificationHistoryPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale(),
    copy = verificationApplicationsCopy(locale),
    labels = verificationCopy(locale),
    dictionary = getDictionary(locale),
    params = new URLSearchParams();
  for (const [key, value] of Object.entries((await searchParams) ?? {}))
    if (value !== undefined)
      for (const part of Array.isArray(value) ? value : [value]) params.append(key, part);
  const filters = parseVerificationApplicationsQuery(params);
  const historyFiltered = Boolean(
    filters?.query || filters?.status !== "all" || filters?.type !== "all",
  );
  const returnPath = params.size
    ? `/workspace/verification/history?${params}`
    : "/workspace/verification/history";
  const retryHref = filters ? returnPath : "/workspace/verification/history";
  const sessionActor = await authService
    .getSession((await cookies()).get("nexus_session")?.value)
    .catch(() => null);
  if (!sessionActor) {
    return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  }
  let error = filters ? "" : copy.invalid;
  const report = await (async () => {
    try {
      return filters
        ? await verificationWorkspaceService.applications(sessionActor, filters)
        : null;
    } catch (failure) {
      error =
        failure instanceof AppError
          ? verificationApplicationsError(locale, failure.code)
          : labels.unavailable;
      return null;
    }
  })();
  return (
    <div className={pageShellClass}>
      <header>
        <h1 className="text-2xl font-bold text-primary">{copy.title}</h1>
        <p className="mt-2 text-sm text-muted">{copy.description}</p>
      </header>
      <Link href="/workspace/verification" className={navLinkClass}>
        {labels.back}
      </Link>
      <search aria-label={copy.query}>
        <form
          method="get"
          action="/workspace/verification/history"
          className="nexus-panel flex min-w-0 flex-wrap items-end gap-3 p-4"
        >
          <label className="min-w-40 flex-1 space-y-1 text-xs text-muted">
            {copy.query}
            <input
              type="search"
              name="q"
              maxLength={100}
              defaultValue={filters?.query ?? ""}
              className={`${platformFieldClass} block min-h-11`}
            />
          </label>
          <label className="space-y-1 text-xs text-muted">
            {copy.status}
            <select
              name="status"
              defaultValue={filters?.status ?? "all"}
              className={`${platformFieldClass} block min-h-11`}
            >
              {(["all", "pending", "approved", "rejected"] as const).map((value) => (
                <option key={value} value={value}>
                  {value === "all" ? copy.all : labels[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted">
            {labels.type}
            <select
              name="type"
              defaultValue={filters?.type ?? "all"}
              className={`${platformFieldClass} block min-h-11`}
            >
              <option value="all">{copy.all}</option>
              {VERIFICATION_TYPES.map((value) => (
                <option key={value} value={value}>
                  {labels[value]}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" className="min-h-11">
            {copy.search}
          </Button>
          {historyFiltered ? (
            <Link prefetch={false} href="/workspace/verification/history" className={navLinkClass}>
              {copy.clear}
            </Link>
          ) : null}
        </form>
      </search>
      <p className="text-xs text-muted">{copy.live}</p>
      <Link
        prefetch={false}
        href={filters ? verificationApplicationsHref(filters) : "/workspace/verification/history"}
        className={navLinkClass}
      >
        {copy.latest}
      </Link>
      {error ? (
        <ErrorState
          id="verification-history-unavailable"
          title={error}
          action={
            <Link href={retryHref} className={navLinkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      ) : null}
      {report && !report.items.length ? (
        <EmptyState
          title={historyFiltered ? copy.emptyFiltered : copy.emptyNever}
          description={historyFiltered ? copy.emptyFilteredHint : copy.emptyNeverHint}
          action={
            historyFiltered ? (
              <Link
                prefetch={false}
                href="/workspace/verification/history"
                className={navLinkClass}
              >
                {copy.clear}
              </Link>
            ) : (
              <Link href="/workspace/verification" className={navLinkClass}>
                {labels.back}
              </Link>
            )
          }
        />
      ) : null}
      <ul className="min-w-0 space-y-3">
        {report?.items.map((item) => (
          <li key={item.id}>
            <article className="nexus-panel min-w-0 space-y-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="min-w-0 break-words font-semibold text-primary">
                  <Link
                    prefetch={false}
                    href={`/workspace/verification/${encodeURIComponent(item.id)}`}
                  >
                    {labels[item.targetType]}
                  </Link>
                </h2>
                <span className="text-xs text-muted">{labels[item.status]}</span>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm text-secondary">{item.notes}</p>
              <p className="break-all text-xs text-muted">{item.id}</p>
              <p className="text-xs text-muted">
                {labels.submittedAt}:{" "}
                <time dateTime={item.createdAt}>
                  {new Date(item.createdAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
                    timeZone: "UTC",
                  })}{" "}
                  UTC
                </time>
              </p>
              <Link
                prefetch={false}
                href={`/workspace/verification/${encodeURIComponent(item.id)}`}
                className={navLinkClass}
              >
                {copy.open}
              </Link>
            </article>
          </li>
        ))}
      </ul>
      {filters && report ? (
        <nav aria-label={copy.title} className="flex flex-wrap justify-between gap-4 text-sm">
          {report.newerCursor ? (
            <Link
              prefetch={false}
              className={navLinkClass}
              href={verificationApplicationsHref(filters, report.newerCursor)}
            >
              {copy.newer}
            </Link>
          ) : null}
          {report.olderCursor ? (
            <Link
              prefetch={false}
              className={navLinkClass}
              href={verificationApplicationsHref(filters, report.olderCursor)}
            >
              {copy.older}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
