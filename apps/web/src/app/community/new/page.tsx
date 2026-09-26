import { CommunityTopicForm } from "../../../components/community-topic-form";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";

export default async function NewCommunityTopicPage() {
  const locale = await getRequestLocale();
  const copy = getDictionary(locale).community;

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-8">
      <div className="space-y-1.5">
        <h1 className="font-display text-primary">{copy.startTitle}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          {copy.startDescription}
        </p>
      </div>
      <CommunityTopicForm />
    </div>
  );
}
