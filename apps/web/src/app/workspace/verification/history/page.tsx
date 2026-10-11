import { AppError } from "@nexus/domain";
import { cookies } from "next/headers";
import Link from "next/link";
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
    params = new URLSearchParams();
  for (const [key, value] of Object.entries((await searchParams) ?? {}))
    if (value !== undefined)
      for (const part of Array.isArray(value) ? value : [value]) params.append(key, part);
  const filters = parseVerificationApplicationsQuery(params);
  let error = filters ? "" : copy.invalid,
    signIn = false;
  const report = await (async () => {
    try {
      const actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
      if (!actor) {
        signIn = true;
        return null;
      }
      return filters ? await verificationWorkspaceService.applications(actor, filters) : null;
    } catch (failure) {
      error =
        failure instanceof AppError
          ? verificationApplicationsError(locale, failure.code)
          : labels.unavailable;
      return null;
    }
  })();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-primary">{copy.title}</h1>
        <p className="mt-2 text-sm text-muted">{copy.description}</p>
      </header>
      <Link
        href="/workspace/verification"
        className="inline-flex min-h-11 items-center text-sm text-accent underline"
      >
        {labels.back}
      </Link>
      {signIn ? (
        <Link
          href="/auth/login"
          className="inline-flex min-h-11 items-center text-accent underline"
        >
          {labels.signIn}
        </Link>
      ) : (
        <>
          <form
            method="get"
            action="/workspace/verification/history"
            className="nexus-panel flex flex-wrap items-end gap-3 p-4"
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
            <button
              type="submit"
              className="min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-white"
            >
              {copy.search}
            </button>
          </form>
          <p className="text-xs text-muted">{copy.live}</p>
          <Link
            prefetch={false}
            href={
              filters ? verificationApplicationsHref(filters) : "/workspace/verification/history"
            }
            className="inline-flex min-h-11 items-center text-sm text-accent underline"
          >
            {copy.latest}
          </Link>
          {error && (
            <p role="alert" className="nexus-panel p-4 text-sm text-danger">
              {error}
            </p>
          )}
          {report && !report.items.length && (
            <p className="nexus-panel p-6 text-sm text-muted">{copy.empty}</p>
          )}
          <ul className="space-y-3">
            {report?.items.map((item) => (
              <li key={item.id}>
                <article className="nexus-panel space-y-3 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h2 className="font-semibold text-primary">
                      <Link
                        prefetch={false}
                        href={`/workspace/verification/${encodeURIComponent(item.id)}`}
                      >
                        {labels[item.targetType]}
                      </Link>
                    </h2>
                    <span className="text-xs text-muted">{labels[item.status]}</span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm text-secondary">
                    {item.notes}
                  </p>
                  <p className="break-all text-xs text-muted">{item.id}</p>
                  <p className="text-xs text-muted">
                    {labels.submittedAt}:{" "}
                    <time dateTime={item.createdAt}>
                      {new Date(item.createdAt).toLocaleString(
                        locale === "ru" ? "ru-RU" : "en-US",
                        { timeZone: "UTC" },
                      )}{" "}
                      UTC
                    </time>
                  </p>
                  <Link
                    prefetch={false}
                    href={`/workspace/verification/${encodeURIComponent(item.id)}`}
                    className="inline-flex min-h-11 items-center text-sm text-accent underline"
                  >
                    {copy.open}
                  </Link>
                </article>
              </li>
            ))}
          </ul>
          {filters && report && (
            <nav aria-label={copy.title} className="flex flex-wrap justify-between gap-4 text-sm">
              {report.newerCursor && (
                <Link
                  prefetch={false}
                  className="inline-flex min-h-11 items-center text-accent underline"
                  href={verificationApplicationsHref(filters, report.newerCursor)}
                >
                  {copy.newer}
                </Link>
              )}
              {report.olderCursor && (
                <Link
                  prefetch={false}
                  className="inline-flex min-h-11 items-center text-accent underline"
                  href={verificationApplicationsHref(filters, report.olderCursor)}
                >
                  {copy.older}
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
