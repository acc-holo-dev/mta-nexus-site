import { AppError } from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import { Package } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformSignIn } from "../../../components/platform-sign-in";
import { StorageDiscoveryControls } from "../../../components/storage-maintenance-controls";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";
import { authService } from "../../../lib/services/auth-service";
import { storageMaintenanceService } from "../../../lib/services/storage-maintenance-service";
import { storageMaintenanceCopy } from "../../../lib/storage-maintenance-i18n";
import { storageQuery } from "../../../lib/storage-maintenance-query";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
const linkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, store, raw] = await Promise.all([getRequestLocale(), cookies(), searchParams]);
  const copy = storageMaintenanceCopy(locale);
  const dictionary = getDictionary(locale);
  const actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor) return <PlatformSignIn locale={locale} returnPath="/admin/storage" />;
  if (actor.role !== "admin") notFound();
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) for (const item of value) params.append(key, item);
    else if (value !== undefined) params.append(key, value);
  }
  let query: ReturnType<typeof storageQuery>;
  try {
    query = storageQuery(params);
  } catch {
    notFound();
  }
  const filtersActive = query.view !== "all";
  const returnHref = (() => {
    const hrefParams = new URLSearchParams({
      ...(query.view !== "all" ? { view: query.view } : {}),
      ...(query.page > 1 ? { page: String(query.page) } : {}),
    });
    return hrefParams.size ? `/admin/storage?${hrefParams}` : "/admin/storage";
  })();
  let forbidden = false;
  const result = await storageMaintenanceService
    .list(actor.id, query.page, query.view)
    .catch((error: unknown) => {
      if (error instanceof AppError && error.statusCode === 403) {
        forbidden = true;
        return null;
      }
      return null;
    });
  if (forbidden) notFound();
  const href = (page: number) => `?view=${query.view}&page=${page}`;
  if (!result) {
    return (
      <div className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8">
        <Link href="/admin" className={linkClass}>
          {copy.back}
        </Link>
        <ErrorState
          title={copy.loadUnavailable}
          action={
            <Link href={returnHref} className={linkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  return (
    <div className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8">
      <Link href="/admin" className={linkClass}>
        {copy.back}
      </Link>
      <h1 className="font-display">{copy.title}</h1>
      <p className="text-secondary">{copy.note}</p>
      <StorageDiscoveryControls locale={locale} />
      <h2>{copy.inventory}</h2>
      <p>
        {copy.deletedBytes}: {result.deletedBytes}
      </p>
      <nav className="flex flex-wrap gap-3" aria-label={copy.status}>
        {Object.entries(copy.states).map(([view, label]) => (
          <Link
            key={view}
            href={`?view=${view}`}
            aria-current={query.view === view ? "page" : undefined}
            className={linkClass}
          >
            {label}
          </Link>
        ))}
      </nav>
      {result.items.length ? (
        <ul className="space-y-3">
          {result.items.map((item) => (
            <li key={item.id} className="nexus-panel min-w-0 space-y-2 p-4">
              <Link href={`/admin/storage/objects/${item.id}`} className={`break-all ${linkClass}`}>
                {item.storageKey}
              </Link>
              <p>
                {copy.states[item.state]} · {copy.size}: {item.identity.sizeBytes} ·{" "}
                {copy.referenced}: {item.referenced ? copy.yes : copy.no}
              </p>
              <p className="text-sm text-muted">
                {copy.modified}: {item.modifiedAt.toISOString()}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title={copy.empty}
          description={filtersActive ? copy.clearFilters : copy.note}
          icon={<Package className="h-6 w-6" aria-hidden="true" />}
          action={
            filtersActive ? (
              <Link href="/admin/storage" className={linkClass}>
                {copy.clearFilters}
              </Link>
            ) : undefined
          }
        />
      )}
      {result.totalPages > 1 && (
        <nav className="flex flex-wrap gap-4 text-sm" aria-label={copy.inventory}>
          {result.page > 1 ? (
            <Link href={href(result.page - 1)} className={linkClass}>
              {copy.previous}
            </Link>
          ) : null}
          <span className="inline-flex min-h-11 items-center">
            {result.page} / {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link href={href(result.page + 1)} className={linkClass}>
              {copy.next}
            </Link>
          ) : null}
        </nav>
      )}
    </div>
  );
}
