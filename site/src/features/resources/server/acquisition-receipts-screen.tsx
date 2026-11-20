import { AppError } from "@nexus/domain";
import { Button, EmptyState, ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { resourceCartReceiptsService } from "../../../lib/services/commerce/resource-cart-receipts-service";
import { formatHistoryDate } from "../../commerce/commerce-history-format";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSmRounded } from "../../shell/link-shell";
import { pageShellMax5xl as pageShellClass } from "../../shell/page-shell";
import { panelSpace3P5 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import {
  typeDisplayPrimary,
  typeFlexWrapGap4Sm,
  typeGrid2Gap4,
  typeSmSecondary,
} from "../../shell/type-shell";
import { resourceCartReceiptsCopy } from "../resource-cart-receipts-i18n";
import {
  resourceCartReceiptQuery,
  resourceCartReceiptsUrl,
  resourceCartReceiptUrl,
} from "../resource-cart-receipts-query";

export async function acquisitionReceiptsMetadata(): Promise<Metadata> {
  return {
    title: `${resourceCartReceiptsCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function AcquisitionReceiptsScreen({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, store, raw] = await Promise.all([getRequestLocale(), cookies(), searchParams]),
    copy = resourceCartReceiptsCopy(locale);
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
        retryHref={"/workspace/acquisitions/receipts"}
      />
    );
  }

  if (!user) {
    const pageParams = new URLSearchParams();
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === "string") pageParams.set(key, value);
    }
    const returnPath = `/workspace/acquisitions/receipts${pageParams.size ? `?${pageParams}` : ""}`;
    return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  }
  let query: ReturnType<typeof resourceCartReceiptQuery>;
  try {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(raw)) {
      if (Array.isArray(value)) for (const item of value) params.append(key, item);
      else if (value !== undefined) params.append(key, value);
    }
    query = resourceCartReceiptQuery(params);
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    return (
      <section className={pageShellClass}>
        <ErrorState
          title={copy.invalid}
          description={copy.invalidHint}
          action={
            <Link href="/workspace/acquisitions/receipts" className={linkAccentSmRounded}>
              {copy.title}
            </Link>
          }
        />
      </section>
    );
  }
  const returnHref = resourceCartReceiptsUrl({ ...query, page: query.page ?? 1 });
  const result = await resourceCartReceiptsService.page(user, query).catch(() => null);
  if (!result) {
    return (
      <div className={pageShellClass}>
        <nav className={typeFlexWrapGap4Sm}>
          <Link href="/workspace/cart" className={linkAccentSmRounded}>
            {copy.cart}
          </Link>
          <Link href="/workspace/acquisitions" className={linkAccentSmRounded}>
            {copy.history}
          </Link>
        </nav>
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
  const current = { ...query, page: result.page };
  const receiptsFiltered = query.days !== "all" || query.evidence !== "all";
  return (
    <div className={pageShellClass}>
      <nav className={typeFlexWrapGap4Sm}>
        <Link href="/workspace/cart" className={linkAccentSmRounded}>
          {copy.cart}
        </Link>
        <Link href="/workspace/acquisitions" className={linkAccentSmRounded}>
          {copy.history}
        </Link>
        <Link href="/workspace/library" className={linkAccentSmRounded}>
          {copy.library}
        </Link>
      </nav>
      <h1 className={typeDisplayPrimary}>{copy.title}</h1>
      <p role="note" className={typeSmSecondary}>
        {copy.note}
      </p>
      <form
        method="get"
        action="/workspace/acquisitions/receipts"
        className="flex flex-wrap items-end gap-4"
      >
        <label className="space-y-2 text-sm">
          <span className="block">{copy.days}</span>
          <select
            name="days"
            defaultValue={String(query.days)}
            className="rounded-md border border-base bg-surface p-2"
          >
            {(["all", 7, 30, 90, 365] as const).map((days) => (
              <option key={days} value={days}>
                {days === "all" ? copy.allTime : `${days} ${copy.dayCount}`}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="block">{copy.evidence}</span>
          <select
            name="evidence"
            defaultValue={query.evidence}
            className="rounded-md border border-base bg-surface p-2"
          >
            {(["all", "reviewed", "legacy"] as const).map((evidence) => (
              <option key={evidence} value={evidence}>
                {copy[evidence]}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="outline" className="text-sm">
          {copy.apply}
        </Button>
        <Link href="/workspace/acquisitions/receipts" className={linkAccentSmRounded}>
          {copy.clear}
        </Link>
      </form>
      {!result.items.length ? (
        <EmptyState
          title={result.total === 0 && !receiptsFiltered ? copy.emptyNever : copy.emptyFiltered}
          description={copy.note}
          action={
            result.total === 0 && !receiptsFiltered ? undefined : (
              <Link href="/workspace/acquisitions/receipts" className={linkAccentSmRounded}>
                {copy.clear}
              </Link>
            )
          }
        />
      ) : (
        <ol className={typeGrid2Gap4}>
          {result.items.map((item) => (
            <li key={item.requestId} className={panelSpace3P5}>
              <h2 className="font-semibold">
                <Link
                  href={resourceCartReceiptUrl(item.requestId)}
                  className={linkAccentSmRounded}
                  prefetch={false}
                >
                  {copy.receipt}
                </Link>
              </h2>
              <p className="text-sm">{item.reviewed ? copy.reviewed : copy.legacy}</p>
              <p className="text-sm">
                {copy.items}: {item.itemCount}
              </p>
              <time dateTime={item.createdAt.toISOString()} className="text-xs text-muted">
                {formatHistoryDate(item.createdAt, locale)}
              </time>
            </li>
          ))}
        </ol>
      )}
      <p className="text-sm text-muted">
        {copy.receipts}: {result.total}
      </p>
      <nav aria-label={copy.page} className={typeFlexWrapGap4Sm}>
        {result.page > 1 ? (
          <Link
            href={resourceCartReceiptsUrl({ ...current, page: result.page - 1 })}
            className={linkAccentSmRounded}
          >
            {copy.previous}
          </Link>
        ) : null}
        <span>
          {copy.page} {result.page} {copy.of} {result.totalPages}
        </span>
        {result.page < result.totalPages ? (
          <Link
            href={resourceCartReceiptsUrl({ ...current, page: result.page + 1 })}
            className={linkAccentSmRounded}
          >
            {copy.next}
          </Link>
        ) : null}
        <a
          href={resourceCartReceiptsUrl(current, true).replace("receipts?", "receipts/export?")}
          className={linkAccentSmRounded}
        >
          {copy.export}
        </a>
      </nav>
    </div>
  );
}
