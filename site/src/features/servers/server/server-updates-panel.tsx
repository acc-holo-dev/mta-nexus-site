import type { Content } from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import { Newspaper } from "lucide-react";
import Link from "next/link";
import { getDictionary, type Locale } from "../../../lib/i18n";
import { ArticleCard } from "../../community/article-view";
import { publicationCopy } from "../../community/publication-feed-copy";
import { linkAccentSm } from "../../shell/link-shell";
import { pageShellStack4 } from "../../shell/page-shell";
import { typeMt1XsMuted } from "../../shell/type-shell";
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
    <section className={pageShellStack4} aria-labelledby="server-updates-heading">
      <div className="flex min-w-0 items-center justify-between gap-4">
        <div className="min-w-0">
          <h2
            id="server-updates-heading"
            className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-primary"
          >
            <Newspaper className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
            {copy.title}
          </h2>
          <p className={typeMt1XsMuted}>{copy.description}</p>
        </div>
        <span className="shrink-0 font-label uppercase text-faint">{copy.moderated}</span>
      </div>
      {serverSlug && (
        <Link href={`/servers/${encodeURIComponent(serverSlug)}/updates`} className={linkAccentSm}>
          {publicationCopy(locale).allUpdates}
        </Link>
      )}

      {updates === null ? (
        <ErrorState
          title={copy.unavailable}
          description={copy.unavailableHint}
          action={
            retryHref ? (
              <Link href={retryHref} className={linkAccentSm}>
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
