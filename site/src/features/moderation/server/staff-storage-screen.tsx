import { AppError } from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import { Package } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { storageMaintenanceService } from "../../../lib/services/moderation/storage-maintenance-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSm, linkMinH } from "../../shell/link-shell";
import { pageShellMax5xl } from "../../shell/page-shell";
import { panelMinSpace2P4 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { typeFlexWrapGap3, typeFlexWrapGap4Sm } from "../../shell/type-shell";
import { StorageDiscoveryControls } from "../storage-maintenance";
import { storageMaintenanceCopy } from "../storage-maintenance-i18n";
import { storageQuery } from "../storage-maintenance-query";

export async function staffStorageMetadata(): Promise<Metadata> {
  return {
    title: `${storageMaintenanceCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function StaffStorageScreen({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, store, raw] = await Promise.all([getRequestLocale(), cookies(), searchParams]);
  const copy = storageMaintenanceCopy(locale);
  const dictionary = getDictionary(locale);
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={copy.loadUnavailable}
        retryHref={"/admin/storage"}
      />
    );
  }

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
      <div className={pageShellMax5xl}>
        <Link href="/admin" className={linkAccentSm}>
          {copy.back}
        </Link>
        <ErrorState
          title={copy.loadUnavailable}
          description={copy.loadUnavailableHint}
          action={
            <Link href={returnHref} className={linkAccentSm}>
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
        {copy.back}
      </Link>
      <h1 className="font-display">{copy.title}</h1>
      <p className="text-secondary">{copy.note}</p>
      <StorageDiscoveryControls key={actor.id} actorId={actor.id} locale={locale} />
      <h2>{copy.inventory}</h2>
      <p>
        {copy.deletedBytes}: {result.deletedBytes}
      </p>
      <nav className={typeFlexWrapGap3} aria-label={copy.status}>
        {Object.entries(copy.states).map(([view, label]) => (
          <Link
            key={view}
            href={`?view=${view}`}
            aria-current={query.view === view ? "page" : undefined}
            className={linkAccentSm}
          >
            {label}
          </Link>
        ))}
      </nav>
      {result.items.length ? (
        <ul className="space-y-3">
          {result.items.map((item) => (
            <li key={item.id} className={panelMinSpace2P4}>
              <Link
                href={`/admin/storage/objects/${item.id}`}
                className={`break-all ${linkAccentSm}`}
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
        <EmptyState
          title={copy.empty}
          description={filtersActive ? copy.clearFilters : copy.note}
          icon={<Package className="h-6 w-6" aria-hidden="true" />}
          action={
            filtersActive ? (
              <Link href="/admin/storage" className={linkAccentSm}>
                {copy.clearFilters}
              </Link>
            ) : undefined
          }
        />
      )}
      {result.totalPages > 1 && (
        <nav className={typeFlexWrapGap4Sm} aria-label={copy.inventory}>
          {result.page > 1 ? (
            <Link href={href(result.page - 1)} className={linkAccentSm}>
              {copy.previous}
            </Link>
          ) : null}
          <span className={linkMinH}>
            {result.page} / {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link href={href(result.page + 1)} className={linkAccentSm}>
              {copy.next}
            </Link>
          ) : null}
        </nav>
      )}
    </div>
  );
}
