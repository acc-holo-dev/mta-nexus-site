import { moderationCopy } from "../../../../../../lib/community-moderation-copy";
import { getRequestLocale } from "../../../../../../lib/i18n-server";
import { moderatedDiscussionCopy } from "../../../../../../lib/moderated-discussion-copy";

export default async function Loading() {
  const locale = await getRequestLocale();
  const title = moderatedDiscussionCopy(locale).title;
  const loading = moderationCopy(locale).loading;
  return (
    <section
      className="mx-auto max-w-4xl space-y-6"
      aria-busy="true"
      aria-labelledby="admin-discussion-comment-loading-heading"
    >
      <header className="space-y-2">
        <h1
          id="admin-discussion-comment-loading-heading"
          className="text-2xl font-extrabold text-primary"
        >
          {title}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-24 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
