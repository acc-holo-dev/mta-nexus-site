import { NotFoundError, RESOURCE_ACTIVITY_DAYS } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { resourceActivityService } from "../../../lib/services/resources/resource-activity-service";
import { formatHistoryDate } from "../../commerce/commerce-history-format";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccent } from "../../shell/link-shell";
import { pageShellMax5xl as pageShellClass } from "../../shell/page-shell";
import { panelSpace2P5 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { typeDisplayPrimary, typeFlexWrapGap3, typeSmSecondary } from "../../shell/type-shell";
import { getResourceActivityCopy } from "../resource-activity-i18n";
import { resourceActivityDays } from "../resource-activity-view";
export async function resourceActivityMetadata(): Promise<Metadata> {
  return {
    title: `${getResourceActivityCopy(await getRequestLocale()).analytics} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function ResourceActivityScreen({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ days?: string | string[] }>;
}) {
  const [locale, cookieStore, { id }, query] = await Promise.all([
    getRequestLocale(),
    cookies(),
    params,
    searchParams,
  ]);
  const copy = getResourceActivityCopy(locale);
  const dictionary = getDictionary(locale);
  const returnParams = new URLSearchParams();
  if (query.days !== undefined) {
    for (const part of Array.isArray(query.days) ? query.days : [query.days])
      returnParams.append("days", part);
  }
  const basePath = `/workspace/resources/${encodeURIComponent(id)}/activity`;
  const returnQuery = returnParams.toString();
  const returnPath = returnQuery ? `${basePath}?${returnQuery}` : basePath;
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession(cookieStore.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={copy.loadUnavailable}
        retryHref={returnPath}
      />
    );
  }

  if (!actor) return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  const result = await resourceActivityService
    .publisherReport(actor, id, resourceActivityDays(query.days))
    .catch((error) => {
      if (error instanceof NotFoundError) notFound();
      return null;
    });
  if (!result) {
    return (
      <div className={pageShellClass}>
        <Link href={`/workspace/resources/${encodeURIComponent(id)}`} className={linkAccent}>
          {copy.back}
        </Link>
        <ErrorState
          title={copy.loadUnavailable}
          description={copy.loadUnavailableHint}
          action={
            <Link href={returnPath} className={linkAccent}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  const href = (days: number) =>
    `/workspace/resources/${encodeURIComponent(id)}/activity?days=${days}`;
  const cards = ["acquisitions", "retainedGrants", "downloadStarts", "direct", "cart"] as const;
  return (
    <div className={pageShellClass}>
      <header className="space-y-3">
        <Link href={`/workspace/resources/${encodeURIComponent(id)}`} className={linkAccent}>
          {copy.back}
        </Link>
        <h1 className={typeDisplayPrimary}>{copy.analytics}</h1>
        <h2 className="break-words text-xl">{result.product.title}</h2>
        <p role="note" className="max-w-3xl text-sm text-secondary">
          {copy.analyticsNote}
        </p>
      </header>
      <nav aria-label={copy.period} className={typeFlexWrapGap3}>
        {RESOURCE_ACTIVITY_DAYS.map((days) => (
          <Link
            key={days}
            href={href(days)}
            aria-current={days === result.days ? "page" : undefined}
            className="inline-flex min-h-11 items-center rounded-md border border-base px-4 py-2 text-sm aria-[current=page]:bg-accent aria-[current=page]:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {days} {copy.days}
          </Link>
        ))}
      </nav>
      <p className="text-xs text-muted">
        <time dateTime={result.from.toISOString()}>{formatHistoryDate(result.from, locale)}</time> —{" "}
        <time dateTime={result.through.toISOString()}>
          {formatHistoryDate(result.through, locale)}
        </time>{" "}
        (UTC)
      </p>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((key) => (
          <div key={key} className={panelSpace2P5}>
            <dt className={typeSmSecondary}>{copy[key]}</dt>
            <dd className="text-2xl font-semibold">
              {result[key].toLocaleString(locale === "ru" ? "ru-RU" : "en-US")}
            </dd>
          </div>
        ))}
      </dl>
      <div className="overflow-x-auto rounded-lg border border-base">
        <table className="w-full text-left text-sm">
          <caption className="p-4 text-left font-semibold">{copy.timeline}</caption>
          <thead>
            <tr>
              <th scope="col" className="px-4 py-3">
                {copy.day}
              </th>
              <th scope="col" className="px-4 py-3">
                {copy.acquisitions}
              </th>
              <th scope="col" className="px-4 py-3">
                {copy.downloadStarts}
              </th>
            </tr>
          </thead>
          <tbody>
            {result.timeline.map((day) => (
              <tr key={day.day} className="border-t border-base">
                <th scope="row" className="px-4 py-3 font-normal">
                  <time dateTime={day.day}>{day.day}</time>
                </th>
                <td className="px-4 py-3">{day.acquisitions}</td>
                <td className="px-4 py-3">{day.downloadStarts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-2">
        <a
          href={`/api/products/${encodeURIComponent(id)}/activity/export?days=${result.days}`}
          className={linkAccent}
        >
          {copy.export}
        </a>
        <p className="text-xs text-muted">{copy.exportNote}</p>
      </div>
    </div>
  );
}
