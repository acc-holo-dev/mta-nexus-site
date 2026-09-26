import Link from "next/link";
import { MessageSquare, Plus } from "lucide-react";
import { EmptyState } from "@nexus/ui";
import { contentService } from "../../lib/services/content-service";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function CommunityPage() {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const copy = dictionary.community;
  const topics = await contentService.listCommunityTopics(50);

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 border-b border-base pb-5 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2 font-display text-primary">
            <MessageSquare className="h-6 w-6 text-accent" aria-hidden="true" />
            <span>{copy.title}</span>
          </h1>
          <p className="mt-1 text-sm text-muted">{copy.description}</p>
        </div>
        <Link
          href="/community/new"
          className="inline-flex self-start items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[var(--nexus-accent-hover)] sm:self-auto"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {copy.newTopic}
        </Link>
      </header>

      {topics.length > 0 ? (
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
                    {topic.type === "question"
                      ? copy.question
                      : copy.discussion}
                  </span>
                  <h2 className="mt-1 truncate font-heading text-primary">
                    {topic.title}
                  </h2>
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
          title={copy.noTopics}
          description={copy.description}
          icon={<MessageSquare className="h-6 w-6" />}
          action={
            <Link
              href="/community/new"
              className="inline-flex rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white"
            >
              {copy.newTopic}
            </Link>
          }
        />
      )}
    </div>
  );
}
