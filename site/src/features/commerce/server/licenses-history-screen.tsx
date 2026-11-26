import { licenseRepository } from "@nexus/db";
import { AppError } from "@nexus/domain";
import { can } from "@nexus/security";
import { EmptyState, ErrorState } from "@nexus/ui";
import { KeyRound } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { isWalletEngineEnabled } from "../../../lib/services/commerce/wallet-payment-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSmRounded } from "../../shell/link-shell";
import { pageShellClip } from "../../shell/page-shell";
import { panelMinSpace3P5 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import {
  typeBreakPrimary,
  typeFlexMinWrapStartBetweenGap3,
  typeGridMinGap3Sm2,
  typeMinBreakBaseSemiboldPrimary,
  typeRoundedBorderPx2Py1XsSecondary,
  typeSmMuted,
} from "../../shell/type-shell";
import {
  effectiveLicenseStatus,
  formatHistoryDate,
  licenseStatusLabel,
} from "../commerce-history-format";
import { commerceHistoryBetaNotice, getCommerceHistoryCopy } from "../commerce-history-i18n";
import {
  licenseArchiveDetailHref,
  licenseArchiveQuery,
  licenseArchiveUrl,
} from "../license-archive-query";
import { getLicenseControlCopy } from "../license-control-i18n";
import { getLicenseMaintenanceCopy } from "../license-maintenance-i18n";
import { getWalletCopy } from "../wallet-i18n";
import { HistoryShell } from "../workspace-history";
import { LicenseArchiveFilters } from "./license-archive-filters";

type Query = Record<string, string | string[] | undefined>;

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

export async function licensesHistoryMetadata(): Promise<Metadata> {
  return {
    title: `${getCommerceHistoryCopy(await getRequestLocale()).licensesTitle} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function LicensesHistoryScreen({ query }: { query: Query }) {
  const [locale, store] = await Promise.all([getRequestLocale(), cookies()]);
  const copy = getCommerceHistoryCopy(locale);
  const typedLocale: "en" | "ru" = locale === "ru" ? "ru" : "en";
  const walletEnabled = isWalletEngineEnabled();
  const historyNotice = commerceHistoryBetaNotice(typedLocale, walletEnabled);
  const walletNavProps = walletEnabled
    ? {
        walletHref: "/workspace/wallet" as const,
        walletLabel: getWalletCopy(typedLocale).walletNav,
      }
    : {};
  const dictionary = getDictionary(locale);
  let user: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    user = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={copy.loadUnavailable}
        retryHref={"/workspace/licenses"}
      />
    );
  }

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
      <div className={pageShellClip}>
        <HistoryShell copy={copy} area="licenses" notice={historyNotice} {...walletNavProps}>
          <ErrorState
            title={copy.loadUnavailable}
            description={copy.loadUnavailableHint}
            action={
              <Link href={retryHref} className={linkAccentSmRounded}>
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
    <div className={pageShellClip}>
      <HistoryShell copy={copy} area="licenses" notice={historyNotice} {...walletNavProps}>
        <LicenseArchiveFilters query={filters} page={result.page} locale={locale} />
        <p role="note" className={typeSmMuted}>
          {copy.licenseNotice}
        </p>
        {can(user, "admin.moderation") && (
          <Link href="/admin/licenses" className={linkAccentSmRounded}>
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
                <Link href="/workspace/licenses" className={linkAccentSmRounded}>
                  {maintenance.clear}
                </Link>
              ) : undefined
            }
          />
        ) : (
          <ol className="space-y-3">
            {result.licenses.map((license) => (
              <li key={license.id} className={panelMinSpace3P5}>
                <div className={typeFlexMinWrapStartBetweenGap3}>
                  <h2 className={typeMinBreakBaseSemiboldPrimary}>{license.productTitle}</h2>
                  <span className={typeRoundedBorderPx2Py1XsSecondary}>
                    {licenseStatusLabel(
                      license.effectiveStatus ??
                        effectiveLicenseStatus(license.status, license.expiresAt, now),
                      copy.licenseStatuses,
                    )}
                  </span>
                </div>
                <dl className={typeGridMinGap3Sm2}>
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
                    <dd className={typeBreakPrimary}>{license.model.replaceAll("_", " ")}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-muted">{copy.binding}</dt>
                    <dd className="text-primary">
                      {license.serverBound ? copy.bound : copy.unbound}
                    </dd>
                  </div>
                </dl>
                <Link
                  href={licenseArchiveDetailHref(license.id, filters)}
                  className={linkAccentSmRounded}
                >
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
                className={linkAccentSmRounded}
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
                className={linkAccentSmRounded}
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

export async function WorkspaceLicensesHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return LicensesHistoryScreen({ query: await searchParams });
}
