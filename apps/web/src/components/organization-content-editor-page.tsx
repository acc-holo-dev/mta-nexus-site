import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { getRequestLocale } from "../lib/i18n-server";
import { organizationContentId } from "../lib/organization-content-api";
import { organizationContentCopy } from "../lib/organization-content-copy";
import { organizationPublicationHistoryCopy } from "../lib/organization-publication-history-copy";
import { authService } from "../lib/services/auth-service";
import { organizationContentService } from "../lib/services/organization-content-service";
import { parseEditableContent } from "../lib/user-platform-client";
import { getUserPlatformCopy, userPlatformError } from "../lib/user-platform-copy";
import { AuthorContentForm } from "./author-content-form";
import { PlatformSignIn } from "./platform-sign-in";

const pageShellClass = "mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";
export async function OrganizationContentEditorPage({
  id,
  contentId,
}: {
  id: string;
  contentId?: string;
}) {
  const locale = await getRequestLocale(),
    copy = getUserPlatformCopy(locale),
    team = organizationContentCopy(locale);
  const actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  const returnPath = contentId
    ? `/workspace/organizations/${encodeURIComponent(id)}/content/${encodeURIComponent(contentId)}`
    : `/workspace/organizations/${encodeURIComponent(id)}/content/new`;
  if (!actor) return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  let failure = copy.unavailable;
  const result = await Promise.resolve()
    .then(async () => {
      const orgId = organizationContentId(id);
      if (contentId)
        return organizationContentService.get(orgId, actor, organizationContentId(contentId));
      return {
        organization: await organizationContentService.context(orgId, actor),
        content: null,
      };
    })
    .catch((error: unknown) => {
      failure =
        error instanceof AppError ? userPlatformError(locale, error.code) : copy.unavailable;
      return null;
    });
  const initial = result?.content ? parseEditableContent(result.content) : null;
  const path = `/workspace/organizations/${encodeURIComponent(id)}/content`;
  return (
    <div className={pageShellClass}>
      <Link href={path} className={navLinkClass}>
        {team.title}
      </Link>
      <h1 className="font-display text-primary">{contentId ? copy.edit : team.new}</h1>
      {contentId && initial && (
        <Link href={`${path}/${encodeURIComponent(contentId)}/history`} className={navLinkClass}>
          {organizationPublicationHistoryCopy(locale).history}
        </Link>
      )}
      {result && (!contentId || (initial && initial.organizationId === id)) ? (
        <AuthorContentForm
          key={`${id}:${contentId ?? "new"}:${initial?.updatedAt ?? "new"}`}
          locale={locale}
          initial={initial ?? undefined}
          organization={result.organization}
        />
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
