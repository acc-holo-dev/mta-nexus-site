import { AppError } from "@nexus/domain";
import { Button, EmptyState, ErrorState } from "@nexus/ui";
import { Package } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { resourceModerationService } from "../../../lib/services/resources/resource-release-control-service";
import { formatHistoryDate, parseHistoryPage } from "../../commerce/commerce-history-format";
import {
  getResourceReleaseControlCopy,
  resourceStatusLabel,
} from "../../library/resource-release-control-i18n";
import { PlatformSignIn } from "../../shell/guest-auth";
import {
  linkAccent,
  linkAccentSm,
  linkAccentSmRounded,
  linkAccentTightBreakSemibold,
  linkMinH,
} from "../../shell/link-shell";
import { pageShellMax5xl } from "../../shell/page-shell";
import { panelMinSpace2P5 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import {
  typeDisplayPrimary,
  typeFlexMinWrapEndGap3,
  typeFlexWrapGap4Sm,
  typeSmSecondary,
  typeSpace1SmSecondary,
  typeXsMuted,
} from "../../shell/type-shell";

const statuses = ["draft", "pending_review", "published", "suspended", "archived"] as const;

export async function staffResourcesMetadata(): Promise<Metadata> {
  return {
    title: `${getResourceReleaseControlCopy(await getRequestLocale()).moderation} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function StaffResourcesScreen({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string | string[];
    status?: string | string[];
    query?: string | string[];
  }>;
}) {
  const [locale, store, query] = await Promise.all([getRequestLocale(), cookies(), searchParams]);
  const copy = getResourceReleaseControlCopy(locale);
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
        retryHref={"/admin/resources"}
      />
    );
  }

  if (!user) return <PlatformSignIn locale={locale} returnPath="/admin/resources" />;
  if (user.role !== "admin" && user.role !== "moderator") notFound();
  const status = statuses.find((value) => value === query.status);
  const search = typeof query.query === "string" ? query.query.trim().slice(0, 100) : "";
  const pageNumber = Math.min(parseHistoryPage(query.page), 1000);
  const filtersActive = Boolean(status || search);
  const returnHref = (() => {
    const params = new URLSearchParams({
      ...(status ? { status } : {}),
      ...(search ? { query: search } : {}),
      ...(pageNumber > 1 ? { page: String(pageNumber) } : {}),
    });
    return params.size ? `/admin/resources?${params}` : "/admin/resources";
  })();
  let forbidden = false;
  const result = await resourceModerationService
    .page(user, pageNumber, status, search)
    .catch((error) => {
      if (error instanceof AppError && error.statusCode === 403) {
        forbidden = true;
        return null;
      }
      return null;
    });
  if (forbidden) notFound();
  const href = (page: number) =>
    `?${new URLSearchParams({ ...(status ? { status } : {}), ...(search ? { query: search } : {}), page: String(page) })}`;

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
        {copy.back}
      </Link>
      <h1 className={typeDisplayPrimary}>{copy.moderation}</h1>
      <p role="note" className={typeSmSecondary}>
        {copy.moderationNote}
      </p>
      <form className={typeFlexMinWrapEndGap3} method="get">
        <label className="min-w-0 flex-1 space-y-1 text-sm text-secondary sm:min-w-40">
          {copy.search}
          <input
            name="query"
            defaultValue={search}
            maxLength={100}
            className="block min-h-11 w-full min-w-0 rounded-md border border-base bg-surface px-3 py-2"
          />
        </label>
        <label className={typeSpace1SmSecondary}>
          {copy.status}
          <select
            name="status"
            defaultValue={status ?? ""}
            className="block min-h-11 rounded-md border border-base bg-surface px-3 py-2"
          >
            <option value="">{copy.allStates}</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {copy[value]}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" className="min-h-11">
          {copy.search}
        </Button>
        {filtersActive ? (
          <Link href="/admin/resources" className={linkAccentSm}>
            {copy.clearFilters}
          </Link>
        ) : null}
      </form>
      {result.resources.length ? (
        <ul className="space-y-3">
          {result.resources.map((product) => (
            <li key={product.id} className={panelMinSpace2P5}>
              <Link
                href={`/admin/resources/${encodeURIComponent(product.id)}`}
                className={linkAccentTightBreakSemibold}
              >
                {product.title}
              </Link>
              <p className={typeSmSecondary}>
                {resourceStatusLabel(locale, product.status)} · {product.currentVersion}
              </p>
              <time dateTime={product.updatedAt.toISOString()} className={typeXsMuted}>
                {formatHistoryDate(product.updatedAt, locale)}
              </time>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title={copy.empty}
          description={filtersActive ? copy.clearFilters : copy.moderationNote}
          icon={<Package className="h-6 w-6" aria-hidden="true" />}
          action={
            filtersActive ? (
              <Link href="/admin/resources" className={linkAccentSm}>
                {copy.clearFilters}
              </Link>
            ) : undefined
          }
        />
      )}
      {result.totalPages > 1 ? (
        <nav aria-label={copy.page} className={typeFlexWrapGap4Sm}>
          {result.page > 1 ? (
            <Link href={href(result.page - 1)} className={linkAccent}>
              {copy.previous}
            </Link>
          ) : null}
          <span className={linkMinH}>
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link href={href(result.page + 1)} className={linkAccent}>
              {copy.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
