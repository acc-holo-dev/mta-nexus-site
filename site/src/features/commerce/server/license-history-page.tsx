import { AppError } from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Locale } from "../../../lib/i18n";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { licenseControlService } from "../../../lib/services/commerce/license-control-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSmRounded } from "../../shell/link-shell";
import { pageShellMax4xl as pageShellClass } from "../../shell/page-shell";
import { panelSpace2P4TextSm } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { typeBreakSecondary, typeDisplayPrimary } from "../../shell/type-shell";
import { formatHistoryDate } from "../commerce-history-format";
import { getLicenseControlCopy, licenseActionLabel } from "../license-control-i18n";
import { licenseRuntimePage } from "../license-runtime-query";

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
  locale: Locale;
  backHref: string;
  backLabel: string;
  retryHref: string;
}) {
  const copy = getLicenseControlCopy(locale),
    dictionary = getDictionary(locale);
  return (
    <div className={pageShellClass}>
      <Link href={backHref} className={linkAccentSmRounded}>
        {backLabel}
      </Link>
      <ErrorState
        title={copy.loadUnavailable}
        description={copy.loadUnavailableHint}
        action={
          <Link href={retryHref} className={linkAccentSmRounded}>
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
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={copy.loadUnavailable}
        retryHref={"/admin/licenses"}
      />
    );
  }

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
      <Link href={`${base}/${encodeURIComponent(licenseId)}`} className={linkAccentSmRounded}>
        {copy.manage}
      </Link>
      <h1 className={typeDisplayPrimary}>{copy.fullHistory}</h1>
      <p className={typeBreakSecondary}>{result.license.productTitle}</p>
      {result.items.length ? (
        <ol className="space-y-3">
          {result.items.map((event) => (
            <li key={event.id} className={panelSpace2P4TextSm}>
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
        <EmptyState title={copy.noHistory} description={copy.noHistoryHint} />
      )}
      {result.totalPages > 1 && (
        <nav aria-label={copy.fullHistory} className="flex gap-4 text-sm">
          {result.page > 1 && (
            <Link href={`?page=${result.page - 1}`} className={linkAccentSmRounded}>
              {copy.previous}
            </Link>
          )}
          <span>
            {result.page} / {result.totalPages}
          </span>
          {result.page < result.totalPages && (
            <Link href={`?page=${result.page + 1}`} className={linkAccentSmRounded}>
              {copy.next}
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

export async function WorkspaceLicenseHistoryRoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return LicenseHistoryPage({ licenseId: id, query });
}

export async function StaffLicenseHistoryRoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return LicenseHistoryPage({ licenseId: id, query, moderation: true });
}
