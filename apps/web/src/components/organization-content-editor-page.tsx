import Link from "next/link";
import { cookies } from "next/headers";
import { AppError } from "@nexus/domain";
import { AuthorContentForm } from "./author-content-form";
import { PlatformSignIn } from "./content-catalog-controls";
import { authService } from "../lib/services/auth-service";
import { organizationContentService } from "../lib/services/organization-content-service";
import { getRequestLocale } from "../lib/i18n-server";
import { getUserPlatformCopy, userPlatformError } from "../lib/user-platform-copy";
import { organizationContentCopy } from "../lib/organization-content-copy";
import { organizationContentId } from "../lib/organization-content-api";
import { parseEditableContent } from "../lib/user-platform-client";
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
  if (!actor) return <PlatformSignIn locale={locale} />;
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
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={path} className="inline-flex min-h-11 items-center text-sm text-accent underline">
        {team.title}
      </Link>
      <h1 className="font-display text-primary">{contentId ? copy.edit : team.new}</h1>
      {result && (!contentId || (initial && initial.organizationId === id)) ? (
        <AuthorContentForm
          key={`${id}:${contentId ?? "new"}:${initial?.updatedAt ?? "new"}`}
          locale={locale}
          initial={initial ?? undefined}
          organization={result.organization}
        />
      ) : (
        <div className="nexus-panel space-y-3 p-5">
          <p role="alert" className="text-sm text-danger">
            {failure}
          </p>
          <Link
            href={contentId ? `${path}/${encodeURIComponent(contentId)}` : `${path}/new`}
            className="text-sm text-accent underline"
          >
            {copy.retry}
          </Link>
        </div>
      )}
    </div>
  );
}
