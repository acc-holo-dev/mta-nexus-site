import type { ResourcePublicationReadinessSummary } from "@nexus/domain";
import Link from "next/link";
import type { Locale } from "../lib/i18n";
import {
  getResourcePublicationReadinessCopy,
  publicationReadinessDetail,
  publicationReadinessOverview,
} from "../lib/resource-publication-readiness-i18n";
import { getResourcePublisherCopy } from "../lib/resource-publisher-i18n";

const stateTone: Record<ResourcePublicationReadinessSummary["items"][number]["state"], string> = {
  complete: "text-success",
  blocked: "text-danger",
  pending: "text-warning",
  not_applicable: "text-muted",
};

export function ResourcePublicationReadinessPanel({
  summary,
  locale,
  previewHref,
}: {
  summary: ResourcePublicationReadinessSummary;
  locale: Locale;
  previewHref: string;
}) {
  const copy = getResourcePublicationReadinessCopy(locale);
  const publisherCopy = getResourcePublisherCopy(locale);
  const overview = publicationReadinessOverview(locale, summary, publisherCopy.readiness);

  return (
    <section
      id="publication-readiness"
      className="nexus-panel space-y-4 p-5"
      aria-labelledby="publication-readiness-heading"
    >
      <div className="space-y-1">
        <h2 id="publication-readiness-heading" className="text-xl font-semibold text-primary">
          {copy.title}
        </h2>
        <p className="text-sm text-secondary">
          {copy.overview}: {overview}
        </p>
      </div>
      <ul className="space-y-3">
        {summary.items.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-2 rounded-lg border border-base bg-inset p-4 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-primary">{copy.items[item.id]}</span>
                <span className="font-label uppercase text-[10px] text-muted">
                  {item.tier === "required" ? copy.required : copy.recommendation}
                </span>
                <span className={`font-label uppercase text-[10px] ${stateTone[item.state]}`}>
                  {copy.states[item.state]}
                </span>
              </div>
              <p className="text-sm text-secondary">{publicationReadinessDetail(locale, item)}</p>
            </div>
            <Link href={item.actionPath} className="shrink-0 text-sm text-accent underline">
              {copy.fix}
            </Link>
          </li>
        ))}
      </ul>
      <div className="space-y-2 text-sm text-muted">
        <p>{copy.checklistNote}</p>
        <p>
          {copy.previewNote}{" "}
          <Link
            href={previewHref}
            className="text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {copy.openPreview}
          </Link>
        </p>
      </div>
    </section>
  );
}
