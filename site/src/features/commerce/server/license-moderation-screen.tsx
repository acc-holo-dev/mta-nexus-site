import { AppError } from "@nexus/domain";
import { can } from "@nexus/security";
import { Button, EmptyState, ErrorState, fieldClass } from "@nexus/ui";
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
import { pageShellMax5xl } from "../../shell/page-shell";
import { panelMinSpace2P5 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { typeDisplayPrimary, typeSemiboldPrimary, typeSmSecondary } from "../../shell/type-shell";
import {
  effectiveLicenseStatus,
  formatHistoryDate,
  licenseStatusLabel,
  parseHistoryPage,
} from "../commerce-history-format";
import { getCommerceHistoryCopy } from "../commerce-history-i18n";
import { getLicenseControlCopy } from "../license-control-i18n";
import { getLicenseMaintenanceCopy } from "../license-maintenance-i18n";

export async function licenseModerationMetadata(): Promise<Metadata> {
  return {
    title: `${getLicenseControlCopy(await getRequestLocale()).moderation} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function LicenseModerationScreen({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; q?: string }>;
}) {
  const [store, locale, query] = await Promise.all([cookies(), getRequestLocale(), searchParams]);
  let user: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    user = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={getDictionary(locale).errors.message}
        retryHref={"/admin/licenses"}
      />
    );
  }

  if (!user) return <PlatformSignIn locale={locale} returnPath="/admin/licenses" />;
  if (!can(user, "admin.moderation")) notFound();
  const copy = getLicenseControlCopy(locale);
  const history = getCommerceHistoryCopy(locale);
  const dictionary = getDictionary(locale);
  const status =
    typeof query.status === "string" && Object.hasOwn(history.licenseStatuses, query.status)
      ? query.status
      : "";
  const text = typeof query.q === "string" ? query.q.trim().slice(0, 120) : "";
  const pageNumber = Math.min(parseHistoryPage(query.page), 1000);
  const filtersActive = Boolean(status || text);
  const returnHref = (() => {
    const params = new URLSearchParams({
      ...(status ? { status } : {}),
      ...(text ? { q: text } : {}),
      ...(pageNumber > 1 ? { page: String(pageNumber) } : {}),
    });
    return params.size ? `/admin/licenses?${params}` : "/admin/licenses";
  })();
  let forbidden = false;
  const result = await licenseControlService
    .moderationPage(user, pageNumber, status, text)
    .catch((error) => {
      if (error instanceof AppError && error.statusCode === 403) {
        forbidden = true;
        return null;
      }
      return null;
    });
  if (forbidden) notFound();
  const href = (page: number) =>
    `/admin/licenses?${new URLSearchParams({
      ...(status ? { status } : {}),
      ...(text ? { q: text } : {}),
      page: String(page),
    })}`;

  if (!result) {
    return (
      <div className={pageShellMax5xl}>
        <Link href="/admin" className={linkAccentSm}>
          {copy.adminBack}
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
    <div className={pageShellMax5xl}>
      <Link href="/admin" className={linkAccentSm}>
        {copy.adminBack}
      </Link>
      <h1 className={typeDisplayPrimary}>{copy.moderation}</h1>
      <p className={typeSmSecondary}>{copy.policy}</p>
      {user.role === "admin" && (
        <Link href="/admin/licenses/maintenance" className={linkAccentSm}>
          {getLicenseMaintenanceCopy(locale).maintenance}
        </Link>
      )}
      <search aria-label={copy.search}>
        <form className="flex min-w-0 flex-wrap items-end gap-3" method="get">
          <input
            name="q"
            defaultValue={text}
            maxLength={120}
            aria-label={copy.search}
            placeholder={copy.search}
            className={fieldClass}
          />
          <select
            name="status"
            defaultValue={status}
            aria-label={history.status}
            className={fieldClass}
          >
            <option value="">{copy.all}</option>
            {Object.entries(history.licenseStatuses).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Button type="submit" className="min-h-11">
            {copy.searchButton}
          </Button>
          {filtersActive ? (
            <Link href="/admin/licenses" className={linkAccentSm}>
              {copy.clearFilters}
            </Link>
          ) : null}
        </form>
      </search>
      {result.licenses.length ? (
        <ol className="space-y-3">
          {result.licenses.map((license) => (
            <li key={license.id} className={panelMinSpace2P5}>
              <h2 className={typeSemiboldPrimary}>{license.productTitle}</h2>
              <p className={typeSmSecondary}>
                {licenseStatusLabel(
                  effectiveLicenseStatus(license.status, license.expiresAt),
                  history.licenseStatuses,
                )}{" "}
                · {license.expiresAt ? formatHistoryDate(license.expiresAt, locale) : history.never}
              </p>
              <Link href={`/admin/licenses/${license.id}`} className={linkAccentSm}>
                {copy.manage} · {license.id}
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          title={copy.empty}
          description={filtersActive ? copy.clearFilters : copy.policy}
          icon={<KeyRound className="h-6 w-6" aria-hidden="true" />}
          action={
            filtersActive ? (
              <Link href="/admin/licenses" className={linkAccentSm}>
                {copy.clearFilters}
              </Link>
            ) : undefined
          }
        />
      )}
      {result.totalPages > 1 ? (
        <nav aria-label={history.page} className="flex flex-wrap justify-between gap-4 text-sm">
          {result.page > 1 ? (
            <Link href={href(result.page - 1)} className={linkAccent}>
              {history.previous}
            </Link>
          ) : (
            <span />
          )}
          <span className={linkMinH}>
            {result.page} / {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link href={href(result.page + 1)} className={linkAccent}>
              {history.next}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
