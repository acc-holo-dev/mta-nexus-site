import { AppError } from "@nexus/domain";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { authEntryHref } from "../../../../components/auth-return-path";
import { OwnDiscussionDetail } from "../../../../components/own-discussion-detail";
import { ownDiscussionCopy } from "../../../../lib/discussion-workspace-copy";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { authService } from "../../../../lib/services/auth-service";
import { discussionWorkspaceService } from "../../../../lib/services/discussion-workspace-service";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return {
    title: ownDiscussionCopy(await getRequestLocale()).open,
    robots: { index: false, follow: false },
  };
}
export default async function OwnCommentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params,
    locale = await getRequestLocale(),
    copy = ownDiscussionCopy(locale);
  let failed = false;
  const actor = await authService
    .getSession((await cookies()).get("nexus_session")?.value)
    .catch(() => {
      failed = true;
      return null;
    });
  const initial = actor
    ? await discussionWorkspaceService.own(actor, id).catch((error: unknown) => {
        if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
        failed = true;
        return null;
      })
    : null;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/workspace/discussions"
        className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
      >
        {copy.back}
      </Link>
      {initial ? (
        <OwnDiscussionDetail
          key={`${initial.id}:${initial.revision}:${initial.available}`}
          initial={initial}
          locale={locale}
        />
      ) : (
        <div className="nexus-panel space-y-4 p-6">
          <h1 className="text-xl font-bold text-primary">{copy.open}</h1>
          {failed ? (
            <>
              <p role="alert" className="text-sm text-danger">
                {copy.failed}
              </p>
              <a
                href={`/workspace/discussions/${encodeURIComponent(id)}`}
                className="inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {copy.reload}
              </a>
            </>
          ) : (
            <Link
              href={authEntryHref("login", `/workspace/discussions/${encodeURIComponent(id)}`)}
              className="inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {copy.signIn}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
