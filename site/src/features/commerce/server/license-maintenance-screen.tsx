import { AppError } from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import { KeyRound } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { licenseControlService } from "../../../lib/services/commerce/license-control-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccent, linkAccentSm, linkAccentSmRounded, linkMinH } from "../../shell/link-shell";
import { pageShellMax4xl } from "../../shell/page-shell";
import { panelMinSpace2P4, panelP4 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import {
  typeDisplayPrimary,
  typeFlexWrapGap4Sm,
  typeSmSecondary,
  typeXlPrimary,
} from "../../shell/type-shell";
import { formatHistoryDate, licenseStatusLabel } from "../commerce-history-format";
import { getCommerceHistoryCopy } from "../commerce-history-i18n";
import { getLicenseMaintenanceCopy } from "../license-maintenance-i18n";
import { licenseRuntimePage } from "../license-runtime-query";
export async function licenseMaintenanceMetadata(): Promise<Metadata> {
  return {
    title: `${getLicenseMaintenanceCopy(await getRequestLocale()).maintenance} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function LicenseMaintenanceScreen({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, store, raw] = await Promise.all([getRequestLocale(), cookies(), searchParams]);
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={getDictionary(locale).errors.message}
        retryHref={"/admin/licenses/maintenance"}
      />
    );
  }

  if (!actor) return <PlatformSignIn locale={locale} returnPath="/admin/licenses/maintenance" />;
  if (actor.role !== "admin") notFound();
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
  const returnHref =
    page > 1 ? `/admin/licenses/maintenance?page=${page}` : "/admin/licenses/maintenance";
  let forbidden = false;
  const result = await licenseControlService.maintenance(actor, page).catch((error: unknown) => {
    if (error instanceof AppError && error.statusCode === 403) {
      forbidden = true;
      return null;
    }
    return null;
  });
  if (forbidden) notFound();
  const copy = getLicenseMaintenanceCopy(locale),
    history = getCommerceHistoryCopy(locale),
    dictionary = getDictionary(locale);

  if (!result) {
    return (
      <div className={pageShellMax4xl}>
        <Link href="/admin/licenses" className={linkAccentSm}>
          {copy.back}
        </Link>
        <ErrorState
          title={copy.loadUnavailable}
          description={copy.loadUnavailableHint}
          action={
            <Link href={returnHref} className={linkAccentSmRounded}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className={pageShellMax4xl}>
      <Link href="/admin/licenses" className={linkAccentSm}>
        {copy.back}
      </Link>
      <h1 className={typeDisplayPrimary}>{copy.maintenance}</h1>
      <p className="text-secondary">{copy.maintenanceNote}</p>
      <dl className="grid gap-4 sm:grid-cols-3">
        {[
          [copy.due, result.expired],
          [copy.warnings, result.expiring],
          [copy.unknownTerms, result.unknownTerms],
        ].map(([label, total]) => (
          <div className={panelP4} key={label}>
            <dt className="text-sm text-muted">{label}</dt>
            <dd className={typeXlPrimary}>{total}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-muted">{copy.worker}</p>
      {result.items.length ? (
        <ol className="space-y-3">
          {result.items.map((license) => (
            <li key={license.id} className={panelMinSpace2P4}>
              <Link
                href={`/admin/licenses/${encodeURIComponent(license.id)}`}
                className="inline-flex min-h-11 items-center break-words text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
                {license.productTitle}
              </Link>
              <p className={typeSmSecondary}>
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
        <EmptyState
          title={copy.empty}
          description={copy.worker}
          icon={<KeyRound className="h-6 w-6" aria-hidden="true" />}
        />
      )}
      {result.totalPages > 1 && (
        <nav aria-label={copy.currentPage} className={typeFlexWrapGap4Sm}>
          {result.page > 1 && (
            <Link href={`?page=${result.page - 1}`} className={linkAccent}>
              {copy.previous}
            </Link>
          )}
          <span className={linkMinH}>
            {result.page} / {result.totalPages}
          </span>
          {result.page < result.totalPages && (
            <Link href={`?page=${result.page + 1}`} className={linkAccent}>
              {copy.next}
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
