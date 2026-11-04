import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { getRequestLocale } from "../lib/i18n-server";
import { serverContentId } from "../lib/server-content-api";
import { serverContentCopy } from "../lib/server-content-copy";
import { serverPublicationHistoryCopy } from "../lib/server-publication-history-copy";
import { authService } from "../lib/services/auth-service";
import { serverContentService } from "../lib/services/server-content-service";
import { parseEditableContent } from "../lib/user-platform-client";
import { getUserPlatformCopy, userPlatformError } from "../lib/user-platform-copy";
import { AuthorContentForm } from "./author-content-form";
import { PlatformSignIn } from "./platform-sign-in";

const pageShellClass = "mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export async function ServerContentEditorPage({
  id,
  contentId,
}: {
  id: string;
  contentId?: string;
}) {
  const locale = await getRequestLocale(),
    copy = getUserPlatformCopy(locale),
    team = serverContentCopy(locale);
  const actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  const returnPath = contentId
    ? `/workspace/servers/${encodeURIComponent(id)}/content/${encodeURIComponent(contentId)}`
    : `/workspace/servers/${encodeURIComponent(id)}/content/new`;
  if (!actor) return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  let failure = copy.unavailable;
  const result = await Promise.resolve()
    .then(async () => {
      const orgId = serverContentId(id);
      if (contentId) return serverContentService.get(orgId, actor, serverContentId(contentId));
      return {
        server: await serverContentService.context(orgId, actor),
        content: null,
      };
    })
    .catch((error: unknown) => {
      failure =
        error instanceof AppError ? userPlatformError(locale, error.code) : copy.unavailable;
      return null;
    });
  const initial = result?.content ? parseEditableContent(result.content) : null;
  const path = `/workspace/servers/${encodeURIComponent(id)}/content`;
  return (
    <div className={pageShellClass}>
      <Link href={path} className={navLinkClass}>
        {team.title}
      </Link>
      <h1 className="font-display text-primary">{contentId ? copy.edit : team.new}</h1>
      {result && (!contentId || (initial && initial.serverId === id)) ? (
        <>
          {contentId && (
            <Link
              href={`${path}/${encodeURIComponent(contentId)}/history`}
              className={navLinkClass}
            >
              {serverPublicationHistoryCopy(locale).history}
            </Link>
          )}
          <AuthorContentForm
            key={`${id}:${contentId ?? "new"}:${initial?.updatedAt ?? "new"}`}
            locale={locale}
            initial={initial ?? undefined}
            server={result.server}
          />
        </>
      ) : (
        <ErrorState
          title={failure}
          action={
            <Link
              href={contentId ? `${path}/${encodeURIComponent(contentId)}` : `${path}/new`}
              className={navLinkClass}
            >
              {copy.retry}
            </Link>
          }
        />
      )}
    </div>
  );
}
