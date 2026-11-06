import type { Content } from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import { Newspaper } from "lucide-react";
import Link from "next/link";
import { getDictionary, type Locale } from "../lib/i18n";
import { publicationCopy } from "../lib/publication-feed-copy";
import { ArticleCard } from "./article-card";

const navLinkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export function ServerUpdatesPanel({
  updates,
  locale = "en",
  serverSlug,
}: {
  updates: readonly Content[] | null;
  locale?: Locale;
  serverSlug?: string;
}) {
  const dictionary = getDictionary(locale);
  const copy = dictionary.serverUpdates;
  const retryHref = serverSlug ? `/servers/${encodeURIComponent(serverSlug)}` : undefined;

  return (
    <section className="min-w-0 space-y-4 overflow-x-clip" aria-labelledby="server-updates-heading">
      <div className="flex min-w-0 items-center justify-between gap-4">
        <div className="min-w-0">
          <h2
            id="server-updates-heading"
            className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-primary"
          >
            <Newspaper className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
            {copy.title}
          </h2>
          <p className="mt-1 text-xs text-muted">{copy.description}</p>
        </div>
        <span className="shrink-0 font-label uppercase text-faint">{copy.moderated}</span>
      </div>
      {serverSlug && (
        <Link href={`/servers/${encodeURIComponent(serverSlug)}/updates`} className={navLinkClass}>
          {publicationCopy(locale).allUpdates}
        </Link>
      )}

      {updates === null ? (
        <ErrorState
          id="server-updates-unavailable"
          title={copy.unavailable}
          action={
            retryHref ? (
              <Link href={retryHref} className={navLinkClass}>
                {dictionary.errors.retry}
              </Link>
            ) : undefined
          }
        />
      ) : updates.length === 0 ? (
        <EmptyState title={copy.empty} description={copy.emptyHint} />
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {updates.map((update) => (
            <ArticleCard key={update.id} article={update} locale={locale} />
          ))}
        </div>
      )}
    </section>
  );
}
