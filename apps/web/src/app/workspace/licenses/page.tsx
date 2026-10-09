import type { Metadata } from "next";
import { cookies } from "next/headers";
import { licenseRepository } from "@nexus/db";
import { authService } from "../../../lib/services/auth-service";
import { getRequestLocale } from "../../../lib/i18n-server";
import { getCommerceHistoryCopy } from "../../../lib/commerce-history-i18n";
import {
  effectiveLicenseStatus,
  formatHistoryDate,
  licenseStatusLabel,
  parseHistoryPage,
} from "../../../lib/commerce-history-format";
import {
  HistoryPagination,
  HistoryShell,
  HistorySignIn,
} from "../../../components/commerce-history-ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "License history | MTA NEXUS",
  robots: { index: false, follow: false },
};

export default async function LicensesHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const [locale, store, query] = await Promise.all([
    getRequestLocale(), cookies(), searchParams,
  ]);
  const copy = getCommerceHistoryCopy(locale);
  const user = await authService.getSession(store.get("nexus_session")?.value);
  if (!user) return <HistorySignIn copy={copy} />;

  const result = await licenseRepository.pageUserHistory(
    user.id,
    parseHistoryPage(query.page),
  );
  const now = new Date();

  return (
    <HistoryShell copy={copy} area="licenses">
      <p role="note" className="text-sm text-muted">{copy.licenseNotice}</p>
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
                    ) : copy.never}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">{copy.model}</dt>
                  <dd className="break-words text-primary">
                    {license.model.replaceAll("_", " ")}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">{copy.binding}</dt>
                  <dd className="text-primary">
                    {license.serverBound ? copy.bound : copy.unbound}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ol>
      )}
      <HistoryPagination
        copy={copy}
        area="licenses"
        page={result.page}
        totalPages={result.totalPages}
      />
    </HistoryShell>
  );
}
