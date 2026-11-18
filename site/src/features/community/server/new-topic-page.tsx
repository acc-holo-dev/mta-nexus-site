import { cookies } from "next/headers";
import Link from "next/link";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { PlatformSessionError } from "../../shell/session-error";
import { CommunityTopicForm } from "../topic-form";

export default async function NewCommunityTopicPage() {
  const locale = await getRequestLocale();
  const copy = getDictionary(locale).community;
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={copy.startTitle}
        message={copy.topicIdentityError}
        retryHref="/community/new"
      />
    );
  }

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
      <CommunityTopicForm key={actor?.id ?? "guest"} actorId={actor?.id ?? null} />
    </div>
  );
}
