import { AppError } from "@nexus/domain";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformSignIn } from "../../../components/content-catalog-controls";
import { StorageDiscoveryControls } from "../../../components/storage-maintenance-controls";
import { getRequestLocale } from "../../../lib/i18n-server";
import { authService } from "../../../lib/services/auth-service";
import { storageMaintenanceService } from "../../../lib/services/storage-maintenance-service";
import { storageMaintenanceCopy } from "../../../lib/storage-maintenance-i18n";
import { storageQuery } from "../../../lib/storage-maintenance-query";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, store, raw] = await Promise.all([getRequestLocale(), cookies(), searchParams]);
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
  const result = await storageMaintenanceService
    .list(actor.id, query.page, query.view)
    .catch((error: unknown) => {
      if (error instanceof AppError && error.statusCode === 403) notFound();
      throw error;
    });
  const copy = storageMaintenanceCopy(locale);
  const href = (page: number) => `?view=${query.view}&page=${page}`;
  return (
    <div className="mx-auto max-w-5xl space-y-6 py-8">
      <Link
        href="/admin"
        className="text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
      >
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
            className="text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {label}
          </Link>
        ))}
      </nav>
      {result.items.length ? (
        <ul className="space-y-3">
          {result.items.map((item) => (
            <li key={item.id} className="nexus-panel space-y-2 p-4">
              <Link
                href={`/admin/storage/objects/${item.id}`}
                className="break-all text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
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
        <p>{copy.empty}</p>
      )}
      {result.totalPages > 1 && (
        <nav className="flex gap-4 text-sm" aria-label={copy.inventory}>
          {result.page > 1 ? (
            <Link
              href={href(result.page - 1)}
              className="text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {copy.previous}
            </Link>
          ) : null}
          <span>
            {result.page} / {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link
              href={href(result.page + 1)}
              className="text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {copy.next}
            </Link>
          ) : null}
        </nav>
      )}
    </div>
  );
}
