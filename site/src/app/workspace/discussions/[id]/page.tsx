import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OwnDiscussionDetail } from "../../../../components/own-discussion-detail";
import { PlatformSignIn } from "../../../../components/platform-sign-in";
import { ownDiscussionCopy } from "../../../../lib/discussion-workspace-copy";
import { getDictionary } from "../../../../lib/i18n";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { authService } from "../../../../lib/services/auth-service";
import { discussionWorkspaceService } from "../../../../lib/services/discussion-workspace-service";

export const dynamic = "force-dynamic";

const pageShellClass = "mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip py-8";
const linkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export async function generateMetadata() {
  return {
    title: ownDiscussionCopy(await getRequestLocale()).open,
    robots: { index: false, follow: false },
  };
}

export default async function OwnCommentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params,
    locale = await getRequestLocale(),
    copy = ownDiscussionCopy(locale),
    dictionary = getDictionary(locale),
    returnPath = `/workspace/discussions/${encodeURIComponent(id)}`;
  const actor = await authService
    .getSession((await cookies()).get("nexus_session")?.value)
    .catch(() => null);
  if (!actor) {
    return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  }
  const initial = await discussionWorkspaceService.own(actor, id).catch((error: unknown) => {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    return null;
  });
  return (
    <div className={pageShellClass}>
      <Link href="/workspace/discussions" className={linkClass}>
        {copy.back}
      </Link>
      {initial ? (
        <OwnDiscussionDetail
          key={`${initial.id}:${initial.revision}:${initial.available}`}
          initial={initial}
          locale={locale}
        />
      ) : (
        <ErrorState
          title={copy.failed}
          action={
            <a href={returnPath} className={linkClass}>
              {dictionary.errors.retry}
            </a>
          }
        />
      )}
    </div>
  );
}
