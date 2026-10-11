import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AppError } from "@nexus/domain";
import { authService } from "../../../../lib/services/auth-service";
import { licenseControlService } from "../../../../lib/services/license-control-service";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { getLicenseMaintenanceCopy } from "../../../../lib/license-maintenance-i18n";
import { licenseRuntimePage } from "../../../../lib/license-runtime-query";
import { formatHistoryDate, licenseStatusLabel } from "../../../../lib/commerce-history-format";
import { getCommerceHistoryCopy } from "../../../../lib/commerce-history-i18n";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${getLicenseMaintenanceCopy(await getRequestLocale()).maintenance} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, store, raw] = await Promise.all([getRequestLocale(), cookies(), searchParams]),
    actor = await authService.getSession(store.get("nexus_session")?.value);
  if (actor?.role !== "admin") notFound();
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) for (const item of value) params.append(key, item);
    else if (value !== undefined) params.append(key, value);
  }
  let page: number;
  try {
    page = licenseRuntimePage(params);
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 400) notFound();
    throw error;
  }
  const result = await licenseControlService.maintenance(actor, page).catch((error: unknown) => {
      if (error instanceof AppError && error.statusCode === 403) notFound();
      throw error;
    }),
    copy = getLicenseMaintenanceCopy(locale),
    history = getCommerceHistoryCopy(locale);
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      <Link href="/admin/licenses" className="text-sm text-accent underline">
        {copy.back}
      </Link>
      <h1 className="font-display text-primary">{copy.maintenance}</h1>
      <p className="text-secondary">{copy.maintenanceNote}</p>
      <dl className="grid gap-4 sm:grid-cols-3">
        {[
          [copy.due, result.expired],
          [copy.warnings, result.expiring],
          [copy.unknownTerms, result.unknownTerms],
        ].map(([label, total]) => (
          <div className="nexus-panel p-4" key={label}>
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="text-xl text-primary">{total}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-muted">{copy.worker}</p>
      {result.items.length ? (
        <ol className="space-y-3">
          {result.items.map((license) => (
            <li key={license.id} className="nexus-panel space-y-2 p-4">
              <Link
                href={`/admin/licenses/${encodeURIComponent(license.id)}`}
                className="break-words text-accent underline"
              >
                {license.productTitle}
              </Link>
              <p className="text-sm text-secondary">
                {licenseStatusLabel(license.status, history.licenseStatuses)} ·{" "}
                {license.event === "expired" ? copy.expiredTitle : copy.expiringTitle}
              </p>
              {license.expiresAt && (
                <time className="text-sm text-muted" dateTime={license.expiresAt.toISOString()}>
                  {formatHistoryDate(license.expiresAt, locale)} UTC
                </time>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-secondary">{copy.empty}</p>
      )}
      {result.totalPages > 1 && (
        <nav aria-label={copy.currentPage} className="flex gap-4 text-sm">
          {result.page > 1 && <Link href={`?page=${result.page - 1}`}>{copy.previous}</Link>}
          <span>
            {result.page} / {result.totalPages}
          </span>
          {result.page < result.totalPages && (
            <Link href={`?page=${result.page + 1}`}>{copy.next}</Link>
          )}
        </nav>
      )}
    </div>
  );
}
