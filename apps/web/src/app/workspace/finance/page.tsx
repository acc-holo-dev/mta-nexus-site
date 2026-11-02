import { financialStatementsRepository } from "@nexus/db";
import { AppError } from "@nexus/domain";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { authEntryHref } from "../../../components/auth-return-path";
import { formatHistoryDate, parseHistoryPage } from "../../../lib/commerce-history-format";
import {
  financialReferenceLabel,
  formatFinancialMinor,
  getFinancialCopy,
} from "../../../lib/financial-i18n";
import { getRequestLocale } from "../../../lib/i18n-server";
import { authService } from "../../../lib/services/auth-service";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Financial statements | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default async function FinancialStatements({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string | string[];
    currency?: string | string[];
    organizationId?: string | string[];
    scopePage?: string | string[];
  }>;
}) {
  const [locale, store, query] = await Promise.all([getRequestLocale(), cookies(), searchParams]);
  const copy = getFinancialCopy(locale),
    user = await authService.getSession(store.get("nexus_session")?.value);
  if (!user) {
    const returnQuery = new URLSearchParams();
    for (const key of ["page", "currency", "organizationId", "scopePage"] as const) {
      const value = query[key];
      if (typeof value === "string") returnQuery.set(key, value);
    }
    const returnPath = `/workspace/finance${returnQuery.size ? `?${returnQuery}` : ""}`;
    return (
      <section className="space-y-4 py-16 text-center">
        <h1 className="font-display text-primary">{copy.signInRequired}</h1>
        <Link
          href={authEntryHref("login", returnPath)}
          className="rounded text-accent underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {copy.signIn}
        </Link>
      </section>
    );
  }
  const currency = ["USD", "EUR", "RUB"].find((value) => value === query.currency),
    organizationId =
      typeof query.organizationId === "string" &&
      /^[A-Za-z0-9_-]{1,128}$/u.test(query.organizationId)
        ? query.organizationId
        : undefined;
  if (query.organizationId && !organizationId) notFound();
  const [result, scopes] = await Promise.all([
    financialStatementsRepository
      .statement(user.id, Math.min(parseHistoryPage(query.page), 1000), currency, organizationId)
      .catch((error) => {
        if (error instanceof AppError && [403, 404].includes(error.statusCode)) notFound();
        throw error;
      }),
    financialStatementsRepository.scopes(
      user.id,
      Math.min(parseHistoryPage(query.scopePage), 1000),
    ),
  ]);
  const href = (
    page: number,
    selectedCurrency: string | null = currency ?? null,
    selectedScope = organizationId,
    scopePage = scopes.page,
  ) =>
    `/workspace/finance?${new URLSearchParams({ page: String(page), scopePage: String(scopePage), ...(selectedCurrency ? { currency: selectedCurrency } : {}), ...(selectedScope ? { organizationId: selectedScope } : {}) })}`;
  return (
    <div className="mx-auto max-w-6xl space-y-6 py-8">
      <Link
        href="/workspace/sales"
        className="text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
      >
        {copy.back}
      </Link>
      <h1 className="font-display text-primary">{copy.title}</h1>
      <h2 className="text-xl text-primary">{result.scope.name ?? copy.personal}</h2>
      <p role="note" className="rounded-md border border-base p-4 text-sm text-secondary">
        {copy.note}
      </p>
      <nav aria-label={copy.currency} className="flex flex-wrap gap-4 text-sm">
        <Link
          href={href(1, null)}
          className="rounded text-accent underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {copy.all}
        </Link>
        {["USD", "EUR", "RUB"].map((value) => (
          <Link
            key={value}
            href={href(1, value)}
            aria-current={value === currency ? "page" : undefined}
            className="rounded text-accent underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {value}
          </Link>
        ))}
      </nav>
      {result.totals.length ? (
        <ul className="grid gap-4 md:grid-cols-3">
          {result.totals.map((total) => (
            <li key={total.currency} className="nexus-panel space-y-3 p-5">
              <h3 className="font-semibold text-primary">{total.currency}</h3>
              <dl className="space-y-2 text-sm">
                {[
                  [copy.balance, total.balance],
                  [copy.credits, total.credits],
                  [copy.debits, total.debits],
                ].map(([label, amount]) => (
                  <div key={label}>
                    <dt className="text-muted">{label}</dt>
                    <dd className="font-numeric text-primary">
                      {formatFinancialMinor(amount, total.currency, locale)}
                    </dd>
                  </div>
                ))}
                <div>
                  <dt className="text-muted">{copy.held}</dt>
                  <dd>{copy.unknown}</dd>
                </div>
                <div>
                  <dt className="text-muted">{copy.available}</dt>
                  <dd>{copy.unknown}</dd>
                </div>
              </dl>
              <p className="text-xs text-muted">
                {copy.legacy}: {total.legacyEntries}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-secondary">{copy.empty}</p>
      )}
      {result.entries.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{copy.title}</caption>
            <thead>
              <tr>
                {[copy.date, copy.reference, copy.currency, copy.balance].map((label) => (
                  <th key={label} className="p-3">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.entries.map((entry) => (
                <tr key={entry.id} className="border-t border-base">
                  <td className="p-3">
                    <time dateTime={entry.createdAt.toISOString()}>
                      {formatHistoryDate(entry.createdAt, locale)}
                    </time>
                    <p className="text-xs text-muted">
                      {entry.journal ? copy.journal : copy.legacy}
                    </p>
                  </td>
                  <td className="break-words p-3">
                    {financialReferenceLabel(locale, entry.referenceType)} · {entry.referenceId}
                  </td>
                  <td className="p-3 font-numeric">
                    {formatFinancialMinor(entry.amount, entry.currency, locale)}
                  </td>
                  <td className="p-3 font-numeric">
                    {formatFinancialMinor(entry.balanceAfter, entry.currency, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {result.totalPages > 1 ? (
        <nav aria-label={copy.page} className="flex gap-4 text-sm">
          {result.page > 1 ? (
            <Link
              href={href(result.page - 1)}
              className="rounded text-accent underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {copy.previous}
            </Link>
          ) : null}
          <span>
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link
              href={href(result.page + 1)}
              className="rounded text-accent underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {copy.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
      <section className="space-y-3 border-t border-base pt-5">
        <h2 className="text-lg font-semibold">{copy.organizations}</h2>
        <Link href="/workspace/finance" className="text-sm text-accent underline">
          {copy.personal}
        </Link>
        <ul className="flex flex-wrap gap-4">
          {scopes.scopes.map((scope) => (
            <li key={scope.id}>
              <Link href={href(1, currency, scope.id)} className="text-sm text-accent underline">
                {scope.name}
              </Link>
            </li>
          ))}
        </ul>
        {scopes.totalPages > 1 ? (
          <nav aria-label={copy.organizations} className="flex gap-4 text-sm">
            {scopes.page > 1 ? (
              <Link
                href={href(result.page, currency, organizationId, scopes.page - 1)}
                className="rounded text-accent underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {copy.previous}
              </Link>
            ) : null}
            <span>
              {copy.page} {scopes.page} {copy.of} {scopes.totalPages}
            </span>
            {scopes.page < scopes.totalPages ? (
              <Link
                href={href(result.page, currency, organizationId, scopes.page + 1)}
                className="rounded text-accent underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {copy.next}
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>
    </div>
  );
}
