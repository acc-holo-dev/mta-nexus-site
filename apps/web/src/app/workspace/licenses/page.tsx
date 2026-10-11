import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppError } from "@nexus/domain";
import { can } from "@nexus/security";
import { licenseRepository } from "@nexus/db";
import { authService } from "../../../lib/services/auth-service";
import { getRequestLocale } from "../../../lib/i18n-server";
import { getCommerceHistoryCopy } from "../../../lib/commerce-history-i18n";
import { getLicenseControlCopy } from "../../../lib/license-control-i18n";
import {
  effectiveLicenseStatus,
  formatHistoryDate,
  licenseStatusLabel,
} from "../../../lib/commerce-history-format";
import { HistoryShell, HistorySignIn } from "../../../components/commerce-history-ui";
import { LicenseArchiveFilters } from "../../../components/license-archive-filters";
import { licenseArchiveQuery, licenseArchiveUrl } from "../../../lib/license-archive-query";

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
  const user = await authService.getSession(store.get("nexus_session")?.value);
  if (!user) return <HistorySignIn copy={copy} />;

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
  const result = await licenseRepository.pageUserHistory(user.id, filters.page, filters);
  const now = new Date();

  return (
    <HistoryShell copy={copy} area="licenses">
      <LicenseArchiveFilters query={filters} page={result.page} locale={locale} />
      <p role="note" className="text-sm text-muted">
        {copy.licenseNotice}
      </p>
      {can(user, "admin.moderation") && (
        <Link href="/admin/licenses" className="text-sm text-accent underline">
          {getLicenseControlCopy(locale).moderation}
        </Link>
      )}
      {result.licenses.length === 0 ? (
        <p className="py-12 text-sm text-secondary">{copy.emptyLicenses}</p>
      ) : (
        <ol className="space-y-3">
          {result.licenses.map((license) => (
            <li key={license.id} className="nexus-panel space-y-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="break-words text-base font-semibold text-primary">
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
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted">{copy.issued}</dt>
                  <dd className="text-primary">
                    <time dateTime={license.createdAt.toISOString()}>
                      {formatHistoryDate(license.createdAt, locale)}
                    </time>
                  </dd>
                </div>
                <div>
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
                <div>
                  <dt className="text-muted">{copy.model}</dt>
                  <dd className="break-words text-primary">{license.model.replaceAll("_", " ")}</dd>
                </div>
                <div>
                  <dt className="text-muted">{copy.binding}</dt>
                  <dd className="text-primary">
                    {license.serverBound ? copy.bound : copy.unbound}
                  </dd>
                </div>
              </dl>
              <Link
                href={`/workspace/licenses/${license.id}`}
                className="text-sm text-accent underline"
              >
                {getLicenseControlCopy(locale).manage}
              </Link>
            </li>
          ))}
        </ol>
      )}
      {result.totalPages > 1 && (
        <nav aria-label={copy.page} className="flex justify-between gap-4 text-sm">
          {result.page > 1 ? (
            <Link
              href={licenseArchiveUrl({ ...filters, page: result.page - 1 })}
              className="text-accent underline"
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
              className="text-accent underline"
            >
              {copy.next}
            </Link>
          )}
        </nav>
      )}
    </HistoryShell>
  );
}
