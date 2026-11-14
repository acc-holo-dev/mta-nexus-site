import { EmptyState, ErrorState } from "@nexus/ui";
import { MessageSquare, Plus } from "lucide-react";
import Link from "next/link";
import {
  ContentCatalogControls,
  ContentPageNavigation,
} from "../../components/content-catalog-controls";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n-server";
import { publicationCopy } from "../../lib/publication-feed-copy";
import { contentService } from "../../lib/services/content-service";
import {
  communityTypes,
  contentPageHref,
  parseContentPage,
} from "../../lib/user-platform-contract";
import { getUserPlatformCopy } from "../../lib/user-platform-copy";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const copy = getDictionary(await getRequestLocale()).community;
  return { title: copy.title, description: copy.description };
}

export default async function CommunityPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const copy = dictionary.community;
  const platformCopy = getUserPlatformCopy(locale);
  const { status: _status, ...filters } = parseContentPage((await searchParams) ?? {});
  const result = await contentService.pageCommunity(filters).catch(() => null);
  const topics = result?.items ?? [];
  const filtersActive = Boolean(filters.query || filters.type || filters.page > 1);

  return (
    <div className="min-w-0 space-y-6 overflow-x-clip">
      <header className="flex flex-col justify-between gap-4 border-b border-base pb-5 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 font-display text-primary">
            <MessageSquare className="h-6 w-6 shrink-0 text-accent" aria-hidden="true" />
            <span>{copy.title}</span>
          </h1>
          <p className="mt-1 text-sm text-muted">{copy.description}</p>
        </div>
        <Link
          href="/community/new"
          className="inline-flex min-h-11 self-start items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[var(--nexus-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)] sm:self-auto"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {copy.newTopic}
        </Link>
      </header>

      <div className="flex flex-wrap gap-4">
        <Link
          href="/workspace/content"
          className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {platformCopy.studio}
        </Link>
        <Link
          href="/workspace/feed"
          className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {publicationCopy(locale).title}
        </Link>
      </div>
      <ContentCatalogControls
        path="/community"
        filters={filters}
        locale={locale}
        types={communityTypes}
      />

      {!result ? (
        <ErrorState
          title={platformCopy.unavailable}
          action={
            <Link
              href={contentPageHref("/community", filters, filters.page)}
              className="inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {dictionary.errors.retry}
            </Link>
          }
        />
      ) : topics.length > 0 ? (
        <section className="space-y-2">
          {topics.map((topic) => (
            <Link
              key={topic.id}
              href={`/articles/${topic.slug}`}
              className="nexus-panel block p-4 transition-colors hover:border-strong hover:bg-hover"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <span className="font-label uppercase text-accent">
                    {topic.type === "question" ? copy.question : copy.discussion}
                  </span>
                  <h2 className="mt-1 truncate font-heading text-primary">{topic.title}</h2>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
                    {topic.excerpt || topic.body}
                  </p>
                </div>
                <span className="shrink-0 font-numeric text-xs text-faint">
                  {topic.commentCount} {copy.replies}
                </span>
              </div>
            </Link>
          ))}
        </section>
      ) : (
        <EmptyState
          title={filtersActive ? copy.emptyFiltered : copy.noTopics}
          description={filtersActive ? copy.clearFilters : copy.description}
          icon={<MessageSquare className="h-6 w-6" />}
          action={
            filtersActive ? (
              <Link
                href="/community"
                className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
                {copy.clearFilters}
              </Link>
            ) : (
              <Link
                href="/community/new"
                className="inline-flex rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]"
              >
                {copy.newTopic}
              </Link>
            )
          }
        />
      )}
      {result && (
        <ContentPageNavigation
          path="/community"
          filters={filters}
          page={result.page}
          hasMore={result.hasMore}
          locale={locale}
        />
      )}
    </div>
  );
}
