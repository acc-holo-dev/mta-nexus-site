import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { organizationWorkspaceService } from "../../../lib/services/organizations/organization-workspace-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { PlatformSessionError } from "../../shell/session-error";
import {
  organizationWorkspaceSchema,
  parseOrganizationPage,
} from "../organization-workspace-contract";
import { getOrganizationCopy, organizationError } from "../organization-workspace-copy";
import { OrganizationWorkspacePanel } from "../workspace";
import { organizationReturnPath } from "./organization-return-path";

const pageShellClass = "mx-auto min-w-0 max-w-5xl space-y-5 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";
export async function generateMetadata() {
  return {
    title: getOrganizationCopy(await getRequestLocale()).title,
    robots: { index: false, follow: false },
  };
}
export default async function OrganizationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, { id }, query] = await Promise.all([getRequestLocale(), params, searchParams]);
  const copy = getOrganizationCopy(locale);
  const returnPath = organizationReturnPath(id, "", query);
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={copy.title}
        message={copy.unavailable}
        retryHref={returnPath}
      />
    );
  }
  if (!actor) return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  const filters = parseOrganizationPage(query);
  let failure = copy.unavailable;
  const result =
    id.length <= 128
      ? await organizationWorkspaceService
          .get(id, actor, filters.page, filters.query)
          .catch((error) => {
            failure =
              error instanceof AppError ? organizationError(locale, error.code) : copy.unavailable;
            return null;
          })
      : null;
  const parsed = organizationWorkspaceSchema.safeParse(result);
  return (
    <div className={pageShellClass}>
      <Link className={navLinkClass} href="/workspace/organizations">
        {copy.back}
      </Link>
      {parsed.success ? (
        <>
          <h1 className="break-words font-display text-primary">{parsed.data.organization.name}</h1>
          <OrganizationWorkspacePanel
            initial={parsed.data}
            actorId={actor.id}
            query={filters.query}
            locale={locale}
          />
        </>
      ) : (
        <div className="space-y-4">
          <h1 className="font-display text-primary">{copy.title}</h1>
          <ErrorState
            title={failure}
            description={copy.unavailableHint}
            action={
              <Link className={navLinkClass} href={returnPath}>
                {copy.reload}
              </Link>
            }
          />
        </div>
      )}
    </div>
  );
}
