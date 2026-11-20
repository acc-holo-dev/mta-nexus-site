import { AppError } from "@nexus/domain";
import { Button, ErrorState } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { organizationTeamService } from "../../../lib/services/organizations/organization-team-service";
import { platformFieldClass } from "../../community/user-platform-client";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSm } from "../../shell/link-shell";
import { pageShellMax4xl as pageShellClass } from "../../shell/page-shell";
import { panelFlexWrapEndP4 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import {
  type2xlExtraboldPrimary,
  typeBreakSemiboldPrimary,
  typeSpace1XsMuted,
} from "../../shell/type-shell";
import {
  organizationTeamHref,
  organizationTeamPageSchema,
  parseOrganizationTeamQuery,
} from "../organization-team-contract";
import { organizationTeamCopy, organizationTeamError } from "../organization-team-copy";
import { getOrganizationCopy } from "../organization-workspace-copy";
import { OrganizationTeamDirectory } from "../team";
export async function teamMetadata() {
  return {
    title: organizationTeamCopy(await getRequestLocale()).title,
    robots: { index: false, follow: false },
  };
}
export async function TeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params,
    locale = await getRequestLocale(),
    copy = organizationTeamCopy(locale),
    team = getOrganizationCopy(locale);
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries((await searchParams) ?? {})) {
    if (Array.isArray(value)) for (const part of value) query.append(key, part);
    else if (value !== undefined) query.append(key, value);
  }
  const teamFilters = parseOrganizationTeamQuery(query);
  const returnPath = teamFilters
    ? organizationTeamHref(id, teamFilters)
    : query.size
      ? `/workspace/organizations/${encodeURIComponent(id)}/team?${query}`
      : organizationTeamHref(id, { query: "" });
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
  const filters = teamFilters;
  let error = filters ? "" : copy.invalid;
  const result = filters
    ? await organizationTeamService.page(id, actor, filters).catch((failure: unknown) => {
        error = organizationTeamError(
          locale,
          failure instanceof AppError ? failure.code : "INTERNAL_ERROR",
        );
        return null;
      })
    : null;
  const parsed = organizationTeamPageSchema.safeParse(result);
  if (result && !parsed.success) error = copy.unavailable;
  return (
    <div className={pageShellClass}>
      <Link href={`/workspace/organizations/${encodeURIComponent(id)}`} className={linkAccentSm}>
        {copy.workspace}
      </Link>
      <header className="space-y-2">
        <h1 className={type2xlExtraboldPrimary}>{copy.title}</h1>
        {parsed.success && (
          <p className={typeBreakSemiboldPrimary}>{parsed.data.organization.name}</p>
        )}
        <p className="text-sm text-muted">{copy.description}</p>
      </header>
      {parsed.success && filters && (
        <>
          <search aria-label={copy.search}>
            <form
              action={organizationTeamHref(id, { query: "" })}
              method="get"
              className={panelFlexWrapEndP4}
            >
              <label className="min-w-40 flex-1 space-y-1 text-xs text-muted">
                {copy.search}
                <input
                  type="search"
                  name="q"
                  defaultValue={filters.query}
                  maxLength={120}
                  className={`${platformFieldClass} block min-h-11`}
                />
              </label>
              <label className={typeSpace1XsMuted}>
                {copy.role}
                <select
                  name="role"
                  defaultValue={filters.role ?? ""}
                  className={`${platformFieldClass} block min-h-11`}
                >
                  <option value="">{copy.all}</option>
                  {(["admin", "developer", "member"] as const).map((role) => (
                    <option key={role} value={role}>
                      {team[role]}
                    </option>
                  ))}
                  <option value="other">{copy.other}</option>
                </select>
              </label>
              <label className={typeSpace1XsMuted}>
                {copy.access}
                <select
                  name="access"
                  defaultValue={filters.access ?? ""}
                  className={`${platformFieldClass} block min-h-11`}
                >
                  <option value="">{copy.all}</option>
                  <option value="yes">{copy.yes}</option>
                  <option value="no">{copy.no}</option>
                </select>
              </label>
              <Button type="submit" className="min-h-11 font-semibold">
                {team.filter}
              </Button>
              <Link href={organizationTeamHref(id, { query: "" })} className={linkAccentSm}>
                {copy.reset}
              </Link>
            </form>
          </search>
          <OrganizationTeamDirectory
            key={`${id}:${actor.id}:${parsed.data.organization.updatedAt}:${JSON.stringify(filters)}`}
            initial={parsed.data}
            filters={filters}
            locale={locale}
            actorId={actor.id}
          />
        </>
      )}
      {error && (
        <ErrorState
          title={error}
          description={copy.unavailableHint}
          action={
            <a href={organizationTeamHref(id, filters ?? { query: "" })} className={linkAccentSm}>
              {team.reload}
            </a>
          }
        />
      )}
    </div>
  );
}
