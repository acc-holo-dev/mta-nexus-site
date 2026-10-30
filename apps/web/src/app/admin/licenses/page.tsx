import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { can } from "@nexus/security";
import { Button } from "@nexus/ui";
import { authService } from "../../../lib/services/auth-service";
import { licenseControlService } from "../../../lib/services/license-control-service";
import { getRequestLocale } from "../../../lib/i18n-server";
import { getLicenseControlCopy } from "../../../lib/license-control-i18n";
import { getCommerceHistoryCopy } from "../../../lib/commerce-history-i18n";
import { getLicenseMaintenanceCopy } from "../../../lib/license-maintenance-i18n";
import {
  effectiveLicenseStatus,
  formatHistoryDate,
  licenseStatusLabel,
  parseHistoryPage,
} from "../../../lib/commerce-history-format";

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
  if (!user || !can(user, "admin.moderation")) notFound();
  const copy = getLicenseControlCopy(locale);
  const history = getCommerceHistoryCopy(locale);
  const status =
    typeof query.status === "string" && Object.hasOwn(history.licenseStatuses, query.status)
      ? query.status
      : "";
  const text = typeof query.q === "string" ? query.q.trim().slice(0, 120) : "";
  const result = await licenseControlService.moderationPage(
    user,
    parseHistoryPage(query.page),
    status,
    text,
  );
  const href = (page: number) =>
    `/admin/licenses?${new URLSearchParams({ page: String(page), status, q: text })}`;
  return (
    <div className="mx-auto max-w-5xl space-y-6 py-8">
      <Link href="/admin" className="text-sm text-accent underline">
        {copy.adminBack}
      </Link>
      <h1 className="font-display text-primary">{copy.moderation}</h1>
      <p className="text-sm text-secondary">{copy.policy}</p>
      {user.role === "admin" && (
        <Link href="/admin/licenses/maintenance" className="text-sm text-accent underline">
          {getLicenseMaintenanceCopy(locale).maintenance}
        </Link>
      )}
      <form className="flex flex-wrap gap-3">
        <input
          name="q"
          defaultValue={text}
          maxLength={120}
          aria-label={copy.search}
          placeholder={copy.search}
          className="nexus-input"
        />
        <select
          name="status"
          defaultValue={status}
          aria-label={history.status}
          className="nexus-input"
        >
          <option value="">{copy.all}</option>
          {Object.entries(history.licenseStatuses).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <Button type="submit">{copy.searchButton}</Button>
      </form>
      {result.licenses.length === 0 ? (
        <p className="text-sm text-muted">{copy.empty}</p>
      ) : (
        <ol className="space-y-3">
          {result.licenses.map((license) => (
            <li key={license.id} className="nexus-panel space-y-2 p-5">
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
                className="text-sm text-accent underline"
              >
                {copy.manage} · {license.id}
              </Link>
            </li>
          ))}
        </ol>
      )}
      <nav aria-label={history.page} className="flex justify-between text-sm">
        {result.page > 1 ? <Link href={href(result.page - 1)}>{history.previous}</Link> : <span />}
        <span>
          {result.page} / {result.totalPages}
        </span>
        {result.page < result.totalPages ? (
          <Link href={href(result.page + 1)}>{history.next}</Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
