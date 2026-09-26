import type { Content } from "@nexus/domain";
import { Newspaper } from "lucide-react";
import { ArticleCard } from "./article-card";
import { getDictionary, type Locale } from "../lib/i18n";

export function ServerUpdatesPanel({
  updates,
  locale = "en",
}: {
  updates: readonly Content[] | null;
  locale?: Locale;
}) {
  const copy = getDictionary(locale).serverUpdates;

  return (
    <section className="space-y-4" aria-labelledby="server-updates-heading">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2
            id="server-updates-heading"
            className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-primary"
          >
            <Newspaper className="h-4 w-4 text-warning" aria-hidden="true" />
            {copy.title}
          </h2>
          <p className="mt-1 text-xs text-muted">{copy.description}</p>
        </div>
        <span className="font-label uppercase text-faint">
          {copy.moderated}
        </span>
      </div>

      {updates === null ? (
        <div className="nexus-panel p-5 text-xs text-warning">
          {copy.unavailable}
        </div>
      ) : updates.length === 0 ? (
        <div className="nexus-panel p-5 text-xs text-faint">
          {copy.empty}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {updates.map((update) => (
            <ArticleCard
              key={update.id}
              article={update}
              locale={locale}
            />
          ))}
        </div>
      )}
    </section>
  );
}
