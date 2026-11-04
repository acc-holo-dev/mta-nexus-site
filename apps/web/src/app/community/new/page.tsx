import Link from "next/link";
import { CommunityTopicForm } from "../../../components/community-topic-form";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";

export default async function NewCommunityTopicPage() {
  const locale = await getRequestLocale();
  const copy = getDictionary(locale).community;

  return (
    <div className="mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip py-8">
      <div className="min-w-0 space-y-1.5">
        <Link
          href="/community"
          className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {copy.backToCommunity}
        </Link>
        <h1 className="font-display text-primary">{copy.startTitle}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">{copy.startDescription}</p>
      </div>
      <CommunityTopicForm />
    </div>
  );
}
