import { licenseRepository } from "@nexus/db";
import { AppError } from "@nexus/domain";
import { can } from "@nexus/security";
import { EmptyState, ErrorState } from "@nexus/ui";
import { KeyRound } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HistoryShell } from "../../../components/commerce-history-ui";
import { LicenseArchiveFilters } from "../../../components/license-archive-filters";
import { PlatformSignIn } from "../../../components/platform-sign-in";
import {
  effectiveLicenseStatus,
  formatHistoryDate,
  licenseStatusLabel,
} from "../../../lib/commerce-history-format";
import { getCommerceHistoryCopy } from "../../../lib/commerce-history-i18n";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";
import { licenseArchiveQuery, licenseArchiveUrl } from "../../../lib/license-archive-query";
import { getLicenseControlCopy } from "../../../lib/license-control-i18n";
import { getLicenseMaintenanceCopy } from "../../../lib/license-maintenance-i18n";
import { authService } from "../../../lib/services/auth-service";

const pageShellClass = "min-w-0 overflow-x-clip";
const navLinkClass =
  "inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

function hasNonDefaultLicenseFilters(filters: ReturnType<typeof licenseArchiveQuery>) {
  return (
    filters.page > 1 ||
    filters.status !== "all" ||
    filters.binding !== "all" ||
    filters.term !== "all" ||
    filters.sort !== "newest" ||
    Boolean(filters.q)
  );
}

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "License history | MTA NEXUS",
  robots: { index: false, follow: false },
};

export default async function LicensesHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, store, query] = await Promise.all([getRequestLocale(), cookies(), searchParams]);
  const copy = getCommerceHistoryCopy(locale);
  const dictionary = getDictionary(locale);
  const user = await authService.getSession(store.get("nexus_session")?.value);
  if (!user) {
    const returnParams = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value)) for (const item of value) returnParams.append(key, item);
      else if (value !== undefined) returnParams.append(key, value);
    }
    const returnPath = returnParams.size
      ? `/workspace/licenses?${returnParams}`
      : "/workspace/licenses";
    return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) for (const item of value) params.append(key, item);
    else if (value !== undefined) params.append(key, value);
  }
  let filters: ReturnType<typeof licenseArchiveQuery>;
  try {
    filters = licenseArchiveQuery(params);
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 400) notFound();
    throw error;
  }
  const retryHref = licenseArchiveUrl(filters);
  const filtersActive = hasNonDefaultLicenseFilters(filters);
  const result = await licenseRepository
    .pageUserHistory(user.id, filters.page, filters)
    .catch(() => null);
  if (!result) {
    return (
      <div className={pageShellClass}>
        <HistoryShell copy={copy} area="licenses">
          <ErrorState
            id="workspace-licenses-unavailable"
            title={copy.loadUnavailable}
            action={
              <Link href={retryHref} className={navLinkClass}>
                {dictionary.errors.retry}
              </Link>
            }
          />
        </HistoryShell>
      </div>
    );
  }
  const now = new Date();
  const maintenance = getLicenseMaintenanceCopy(locale);
  const control = getLicenseControlCopy(locale);

  return (
    <div className={pageShellClass}>
      <HistoryShell copy={copy} area="licenses">
        <LicenseArchiveFilters query={filters} page={result.page} locale={locale} />
        <p role="note" className="text-sm text-muted">
          {copy.licenseNotice}
        </p>
        {can(user, "admin.moderation") && (
          <Link href="/admin/licenses" className={navLinkClass}>
            {control.moderation}
          </Link>
        )}
        {result.licenses.length === 0 ? (
          <EmptyState
            title={filtersActive ? copy.emptyLicensesFiltered : copy.emptyLicenses}
            description={copy.licenseNotice}
            icon={<KeyRound className="h-6 w-6" aria-hidden="true" />}
            action={
              filtersActive ? (
                <Link href="/workspace/licenses" className={navLinkClass}>
                  {maintenance.clear}
                </Link>
              ) : undefined
            }
          />
        ) : (
          <ol className="space-y-3">
            {result.licenses.map((license) => (
              <li key={license.id} className="nexus-panel min-w-0 space-y-3 p-5">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                  <h2 className="min-w-0 break-words text-base font-semibold text-primary">
                    {license.productTitle}
                  </h2>
                  <span className="rounded-md border border-base px-2 py-1 text-xs text-secondary">
                    {licenseStatusLabel(
                      license.effectiveStatus ??
                        effectiveLicenseStatus(license.status, license.expiresAt, now),
                      copy.licenseStatuses,
                    )}
                  </span>
                </div>
                <dl className="grid min-w-0 gap-3 text-sm sm:grid-cols-2">
                  <div className="min-w-0">
                    <dt className="text-muted">{copy.issued}</dt>
                    <dd className="text-primary">
                      <time dateTime={license.createdAt.toISOString()}>
                        {formatHistoryDate(license.createdAt, locale)}
                      </time>
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-muted">{copy.expires}</dt>
                    <dd className="text-primary">
                      {license.expiresAt ? (
                        <time dateTime={license.expiresAt.toISOString()}>
                          {formatHistoryDate(license.expiresAt, locale)}
                        </time>
                      ) : (
                        copy.never
                      )}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-muted">{copy.model}</dt>
                    <dd className="break-words text-primary">
                      {license.model.replaceAll("_", " ")}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-muted">{copy.binding}</dt>
                    <dd className="text-primary">
                      {license.serverBound ? copy.bound : copy.unbound}
                    </dd>
                  </div>
                </dl>
                <Link href={`/workspace/licenses/${license.id}`} className={navLinkClass}>
                  {control.manage}
                </Link>
              </li>
            ))}
          </ol>
        )}
        {result.totalPages > 1 && (
          <nav
            aria-label={copy.page}
            className="flex min-w-0 flex-wrap justify-between gap-4 text-sm"
          >
            {result.page > 1 ? (
              <Link
                href={licenseArchiveUrl({ ...filters, page: result.page - 1 })}
                className={navLinkClass}
              >
                {copy.previous}
              </Link>
            ) : (
              <span />
            )}
            <span>
              {copy.page} {result.page} {copy.of} {result.totalPages}
            </span>
            {result.page < result.totalPages && (
              <Link
                href={licenseArchiveUrl({ ...filters, page: result.page + 1 })}
                className={navLinkClass}
              >
                {copy.next}
              </Link>
            )}
          </nav>
        )}
      </HistoryShell>
    </div>
  );
}
