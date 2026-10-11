import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AppError } from "@nexus/domain";
import { authService } from "../lib/services/auth-service";
import { licenseControlService } from "../lib/services/license-control-service";
import { getRequestLocale } from "../lib/i18n-server";
import { getLicenseControlCopy, licenseActionLabel } from "../lib/license-control-i18n";
import { getCommerceHistoryCopy } from "../lib/commerce-history-i18n";
import { formatHistoryDate } from "../lib/commerce-history-format";
import { licenseRuntimePage } from "../lib/license-runtime-query";
import { HistorySignIn } from "./commerce-history-ui";

export async function licenseHistoryMetadata(): Promise<Metadata> {
  return {
    title: `${getLicenseControlCopy(await getRequestLocale()).fullHistory} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}
export async function LicenseHistoryPage({
  licenseId,
  moderation = false,
  query,
}: {
  licenseId: string;
  moderation?: boolean;
  query: Record<string, string | string[] | undefined>;
}) {
  const [locale, store] = await Promise.all([getRequestLocale(), cookies()]),
    copy = getLicenseControlCopy(locale);
  const actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor) return <HistorySignIn copy={getCommerceHistoryCopy(locale)} />;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) for (const item of value) params.append(key, item);
    else if (value !== undefined) params.append(key, value);
  }
  let page = 1;
  try {
    page = licenseRuntimePage(params);
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 400) notFound();
    throw error;
  }
  const result = await licenseControlService
    .history(actor, licenseId, page, moderation)
    .catch((error: unknown) => {
      if (error instanceof AppError && [403, 404].includes(error.statusCode)) notFound();
      throw error;
    });
  const base = moderation ? "/admin/licenses" : "/workspace/licenses";
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      <Link
        href={`${base}/${encodeURIComponent(licenseId)}`}
        className="text-sm text-accent underline"
      >
        {copy.manage}
      </Link>
      <h1 className="font-display text-primary">{copy.fullHistory}</h1>
      <p className="break-words text-secondary">{result.license.productTitle}</p>
      {result.items.length ? (
        <ol className="space-y-3">
          {result.items.map((event) => (
            <li key={event.id} className="nexus-panel space-y-2 p-4 text-sm">
              <p>
                {licenseActionLabel(locale, event.action)} ·{" "}
                {event.actorType === "admin"
                  ? copy.staff
                  : event.actorType === "system"
                    ? copy.system
                    : copy.owner}
              </p>
              {event.reason && (
                <p className="whitespace-pre-wrap break-words text-secondary">{event.reason}</p>
              )}
              {event.fromEndpointRevision !== null && event.toEndpointRevision !== null && (
                <p className="text-xs text-muted">
                  {copy.endpointRevision}: {event.fromEndpointRevision} → {event.toEndpointRevision}
                </p>
              )}
              <time dateTime={event.createdAt.toISOString()} className="text-xs text-muted">
                {formatHistoryDate(event.createdAt, locale)}
              </time>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-secondary">{copy.noHistory}</p>
      )}
      {result.totalPages > 1 && (
        <nav aria-label={copy.fullHistory} className="flex gap-4 text-sm">
          {result.page > 1 && (
            <Link href={`?page=${result.page - 1}`} className="text-accent underline">
              {copy.previous}
            </Link>
          )}
          <span>
            {result.page} / {result.totalPages}
          </span>
          {result.page < result.totalPages && (
            <Link href={`?page=${result.page + 1}`} className="text-accent underline">
              {copy.next}
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
