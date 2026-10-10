import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { NotFoundError, RESOURCE_ACTIVITY_DAYS } from "@nexus/domain";
import { authService } from "../../../../../lib/services/auth-service";
import { resourceActivityService } from "../../../../../lib/services/resource-activity-service";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { getResourceActivityCopy } from "../../../../../lib/resource-activity-i18n";
import { resourceActivityDays } from "../../../../../lib/resource-activity-view";
import { formatHistoryDate } from "../../../../../lib/commerce-history-format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Resource activity | MTA NEXUS",
  robots: { index: false, follow: false },
};

export default async function ResourceActivityPage({
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
  const actor = await authService.getSession(cookieStore.get("nexus_session")?.value);
  if (!actor)
    return (
      <section className="space-y-4 py-16 text-center">
        <h1>{copy.signInRequired}</h1>
        <Link href="/auth/login" className="text-accent underline">
          {copy.signIn}
        </Link>
      </section>
    );
  const result = await resourceActivityService
    .publisherReport(actor, id, resourceActivityDays(query.days))
    .catch((error) => {
      if (error instanceof NotFoundError) notFound();
      throw error;
    });
  const href = (days: number) =>
    `/workspace/resources/${encodeURIComponent(id)}/activity?days=${days}`;
  const cards = ["acquisitions", "retainedGrants", "downloadStarts", "direct", "cart"] as const;
  return (
    <div className="mx-auto max-w-5xl space-y-6 py-8">
      <header className="space-y-3">
        <Link
          href={`/workspace/resources/${encodeURIComponent(id)}`}
          className="text-accent underline"
        >
          {copy.back}
        </Link>
        <h1 className="font-display text-primary">{copy.analytics}</h1>
        <h2 className="break-words text-xl">{result.product.title}</h2>
        <p role="note" className="max-w-3xl text-sm text-secondary">
          {copy.analyticsNote}
        </p>
      </header>
      <nav aria-label={copy.period} className="flex flex-wrap gap-3">
        {RESOURCE_ACTIVITY_DAYS.map((days) => (
          <Link
            key={days}
            href={href(days)}
            aria-current={days === result.days ? "page" : undefined}
            className="rounded-md border border-base px-4 py-2 text-sm aria-[current=page]:bg-accent aria-[current=page]:text-white"
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
          <div key={key} className="nexus-panel space-y-2 p-5">
            <dt className="text-sm text-secondary">{copy[key]}</dt>
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
          className="text-accent underline"
        >
          {copy.export}
        </a>
        <p className="text-xs text-muted">{copy.exportNote}</p>
      </div>
    </div>
  );
}
