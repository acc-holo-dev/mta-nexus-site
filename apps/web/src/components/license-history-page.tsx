import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatHistoryDate } from "../lib/commerce-history-format";
import { getDictionary } from "../lib/i18n";
import { getRequestLocale } from "../lib/i18n-server";
import { getLicenseControlCopy, licenseActionLabel } from "../lib/license-control-i18n";
import { licenseRuntimePage } from "../lib/license-runtime-query";
import { authService } from "../lib/services/auth-service";
import { licenseControlService } from "../lib/services/license-control-service";
import { PlatformSignIn } from "./platform-sign-in";

const pageShellClass = "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

function licenseHistoryAccessError(error: unknown): "missing" | "failed" {
  if (error instanceof AppError && [403, 404].includes(error.statusCode)) return "missing";
  return "failed";
}

function LicenseHistoryLoadError({
  locale,
  backHref,
  backLabel,
  retryHref,
}: {
  locale: string;
  backHref: string;
  backLabel: string;
  retryHref: string;
}) {
  const copy = getLicenseControlCopy(locale),
    dictionary = getDictionary(locale);
  return (
    <div className={pageShellClass}>
      <Link href={backHref} className={navLinkClass}>
        {backLabel}
      </Link>
      <ErrorState
        title={copy.loadUnavailable}
        action={
          <Link href={retryHref} className={navLinkClass}>
            {dictionary.errors.retry}
          </Link>
        }
      />
    </div>
  );
}

export async function licenseHistoryMetadata(): Promise<Metadata> {
  return {
    title: `${getLicenseControlCopy(await getRequestLocale()).fullHistory} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}
export async function LicenseHistoryPage({
  licenseId,
  moderation = false,
  query,
}: {
  licenseId: string;
  moderation?: boolean;
  query: Record<string, string | string[] | undefined>;
}) {
  const [locale, store] = await Promise.all([getRequestLocale(), cookies()]),
    copy = getLicenseControlCopy(locale);
  const actor = await authService.getSession(store.get("nexus_session")?.value);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) for (const item of value) params.append(key, item);
    else if (value !== undefined) params.append(key, value);
  }
  const base = moderation ? "/admin/licenses" : "/workspace/licenses";
  const historyBase = `${base}/${encodeURIComponent(licenseId)}/history`;
  const returnPath = `${historyBase}${params.size ? `?${params}` : ""}`;
  if (!actor) {
    return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  }
  let page = 1;
  try {
    page = licenseRuntimePage(params);
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 400) notFound();
    throw error;
  }
  let result: Awaited<ReturnType<typeof licenseControlService.history>> | null = null;
  try {
    result = await licenseControlService.history(actor, licenseId, page, moderation);
  } catch (error) {
    if (licenseHistoryAccessError(error) === "missing") notFound();
    return (
      <LicenseHistoryLoadError
        locale={locale}
        backHref={`${base}/${encodeURIComponent(licenseId)}`}
        backLabel={copy.manage}
        retryHref={returnPath}
      />
    );
  }
  return (
    <div className={pageShellClass}>
      <Link href={`${base}/${encodeURIComponent(licenseId)}`} className={navLinkClass}>
        {copy.manage}
      </Link>
      <h1 className="font-display text-primary">{copy.fullHistory}</h1>
      <p className="break-words text-secondary">{result.license.productTitle}</p>
      {result.items.length ? (
        <ol className="space-y-3">
          {result.items.map((event) => (
            <li key={event.id} className="nexus-panel space-y-2 p-4 text-sm">
              <p>
                {licenseActionLabel(locale, event.action)} ·{" "}
                {event.actorType === "admin"
                  ? copy.staff
                  : event.actorType === "system"
                    ? copy.system
                    : copy.owner}
              </p>
              {event.reason && (
                <p className="whitespace-pre-wrap break-words text-secondary">{event.reason}</p>
              )}
              {event.fromEndpointRevision !== null && event.toEndpointRevision !== null && (
                <p className="text-xs text-muted">
                  {copy.endpointRevision}: {event.fromEndpointRevision} → {event.toEndpointRevision}
                </p>
              )}
              <time dateTime={event.createdAt.toISOString()} className="text-xs text-muted">
                {formatHistoryDate(event.createdAt, locale)}
              </time>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-secondary">{copy.noHistory}</p>
      )}
      {result.totalPages > 1 && (
        <nav aria-label={copy.fullHistory} className="flex gap-4 text-sm">
          {result.page > 1 && (
            <Link href={`?page=${result.page - 1}`} className={navLinkClass}>
              {copy.previous}
            </Link>
          )}
          <span>
            {result.page} / {result.totalPages}
          </span>
          {result.page < result.totalPages && (
            <Link href={`?page=${result.page + 1}`} className={navLinkClass}>
              {copy.next}
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
