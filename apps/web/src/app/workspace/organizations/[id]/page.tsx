import Link from "next/link";
import { AppError } from "@nexus/domain";
import { cookies } from "next/headers";
import { authService } from "../../../../lib/services/auth-service";
import { organizationWorkspaceService } from "../../../../lib/services/organization-workspace-service";
import { getRequestLocale } from "../../../../lib/i18n-server";
import {
  organizationError,
  getOrganizationCopy,
} from "../../../../lib/organization-workspace-copy";
import {
  parseOrganizationPage,
  organizationWorkspaceSchema,
} from "../../../../lib/organization-workspace-contract";
import { PlatformSignIn } from "../../../../components/content-catalog-controls";
import { OrganizationWorkspacePanel } from "../../../../components/organization-workspace";
export const dynamic = "force-dynamic";
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
  if (!actor) return <PlatformSignIn locale={locale} />;
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
    <div className="space-y-5">
      <Link className="text-sm text-accent underline" href="/workspace/organizations">
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
        <div className="nexus-panel space-y-3 p-5">
          <p role="alert" className="text-sm text-danger">
            {failure}
          </p>
          <Link
            className="text-sm text-accent underline"
            href={`/workspace/organizations/${encodeURIComponent(id)}`}
          >
            {copy.reload}
          </Link>
        </div>
      )}
    </div>
  );
}
