import { AppError } from "@nexus/domain";
import { can } from "@nexus/security";
import { Button, EmptyState, ErrorState, fieldClass } from "@nexus/ui";
import { KeyRound } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformSignIn } from "../../../components/platform-sign-in";
import {
  effectiveLicenseStatus,
  formatHistoryDate,
  licenseStatusLabel,
  parseHistoryPage,
} from "../../../lib/commerce-history-format";
import { getCommerceHistoryCopy } from "../../../lib/commerce-history-i18n";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";
import { getLicenseControlCopy } from "../../../lib/license-control-i18n";
import { getLicenseMaintenanceCopy } from "../../../lib/license-maintenance-i18n";
import { authService } from "../../../lib/services/auth-service";
import { licenseControlService } from "../../../lib/services/license-control-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "License moderation | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default async function LicensesModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; q?: string }>;
}) {
  const [store, locale, query] = await Promise.all([cookies(), getRequestLocale(), searchParams]);
  const user = await authService.getSession(store.get("nexus_session")?.value);
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
      <div className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8">
        <Link
          href="/admin"
          className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {copy.adminBack}
        </Link>
        <ErrorState
          title={copy.loadUnavailable}
          action={
            <Link
              href={returnHref}
              className="inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8">
      <Link
        href="/admin"
        className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
      >
        {copy.adminBack}
      </Link>
      <h1 className="font-display text-primary">{copy.moderation}</h1>
      <p className="text-sm text-secondary">{copy.policy}</p>
      {user.role === "admin" && (
        <Link
          href="/admin/licenses/maintenance"
          className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
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
            <Link
              href="/admin/licenses"
              className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {copy.clearFilters}
            </Link>
          ) : null}
        </form>
      </search>
      {result.licenses.length ? (
        <ol className="space-y-3">
          {result.licenses.map((license) => (
            <li key={license.id} className="nexus-panel min-w-0 space-y-2 p-5">
              <h2 className="font-semibold text-primary">{license.productTitle}</h2>
              <p className="text-sm text-secondary">
                {licenseStatusLabel(
                  effectiveLicenseStatus(license.status, license.expiresAt),
                  history.licenseStatuses,
                )}{" "}
                · {license.expiresAt ? formatHistoryDate(license.expiresAt, locale) : history.never}
              </p>
              <Link
                href={`/admin/licenses/${license.id}`}
                className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
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
              <Link
                href="/admin/licenses"
                className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
                {copy.clearFilters}
              </Link>
            ) : undefined
          }
        />
      )}
      {result.totalPages > 1 ? (
        <nav aria-label={history.page} className="flex flex-wrap justify-between gap-4 text-sm">
          {result.page > 1 ? (
            <Link
              href={href(result.page - 1)}
              className="inline-flex min-h-11 items-center text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {history.previous}
            </Link>
          ) : (
            <span />
          )}
          <span className="inline-flex min-h-11 items-center">
            {result.page} / {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link
              href={href(result.page + 1)}
              className="inline-flex min-h-11 items-center text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
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
