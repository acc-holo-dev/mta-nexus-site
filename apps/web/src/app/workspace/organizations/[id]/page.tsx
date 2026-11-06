import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { OrganizationWorkspacePanel } from "../../../../components/organization-workspace";
import { PlatformSignIn } from "../../../../components/platform-sign-in";
import { getRequestLocale } from "../../../../lib/i18n-server";
import {
  organizationWorkspaceSchema,
  parseOrganizationPage,
} from "../../../../lib/organization-workspace-contract";
import {
  getOrganizationCopy,
  organizationError,
} from "../../../../lib/organization-workspace-copy";
import { authService } from "../../../../lib/services/auth-service";
import { organizationWorkspaceService } from "../../../../lib/services/organization-workspace-service";
export const dynamic = "force-dynamic";
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
  const [locale, store, { id }, query] = await Promise.all([
    getRequestLocale(),
    cookies(),
    params,
    searchParams,
  ]);
  const actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor)
    return (
      <PlatformSignIn
        locale={locale}
        returnPath={`/workspace/organizations/${encodeURIComponent(id)}`}
      />
    );
  const copy = getOrganizationCopy(locale);
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
        <ErrorState
          id="workspace-organization-detail-unavailable"
          title={failure}
          action={
            <Link
              className={navLinkClass}
              href={`/workspace/organizations/${encodeURIComponent(id)}`}
            >
              {copy.reload}
            </Link>
          }
        />
      )}
    </div>
  );
}
