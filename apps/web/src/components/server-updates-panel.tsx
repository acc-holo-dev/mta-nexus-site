import type { Content } from "@nexus/domain";
import { Newspaper } from "lucide-react";
import { ArticleCard } from "./article-card";

export function ServerUpdatesPanel({
  updates,
}: {
  updates: readonly Content[] | null;
}) {
  return (
    <section
      className="space-y-4"
      aria-labelledby="server-updates-heading"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2
            id="server-updates-heading"
            className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white"
          >
            <Newspaper className="h-4 w-4 text-amber-400" aria-hidden="true" />
            Server updates
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            Published articles, news, devlogs and announcements linked to this
            server.
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-neutral-600">
          Moderated content
        </span>
      </div>

      {updates === null ? (
        <div className="nexus-panel p-5 text-xs text-amber-300">
          Server updates are temporarily unavailable. Live server status is
          unaffected.
        </div>
      ) : updates.length === 0 ? (
        <div className="nexus-panel p-5 text-xs text-neutral-500">
          No published server updates yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {updates.map((update) => (
            <ArticleCard key={update.id} article={update} />
          ))}
        </div>
      )}
    </section>
  );
}
