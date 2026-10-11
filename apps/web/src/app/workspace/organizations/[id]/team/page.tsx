import Link from "next/link";
import { cookies } from "next/headers";
import { AppError } from "@nexus/domain";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { authService } from "../../../../../lib/services/auth-service";
import { organizationTeamService } from "../../../../../lib/services/organization-team-service";
import {
  organizationTeamCopy,
  organizationTeamError,
} from "../../../../../lib/organization-team-copy";
import { getOrganizationCopy } from "../../../../../lib/organization-workspace-copy";
import {
  organizationTeamHref,
  organizationTeamPageSchema,
  parseOrganizationTeamQuery,
} from "../../../../../lib/organization-team-contract";
import { OrganizationTeamDirectory } from "../../../../../components/organization-team-directory";
import { platformFieldClass } from "../../../../../lib/user-platform-client";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return {
    title: organizationTeamCopy(await getRequestLocale()).title,
    robots: { index: false, follow: false },
  };
}
export default async function TeamPage({
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
  let authFailed = false;
  const actor = await authService
    .getSession((await cookies()).get("nexus_session")?.value)
    .catch(() => {
      authFailed = true;
      return null;
    });
  if (!actor)
    return (
      <div className="nexus-panel mx-auto max-w-md space-y-4 p-6">
        <h1 className="text-xl font-bold text-primary">{copy.title}</h1>
        {authFailed ? (
          <>
            <p role="alert" className="text-sm text-danger">
              {copy.unavailable}
            </p>
            <a
              href={organizationTeamHref(id, { query: "" })}
              className="inline-flex min-h-11 items-center text-sm text-accent underline"
            >
              {team.reload}
            </a>
          </>
        ) : (
          <Link
            href="/auth/login"
            className="inline-flex min-h-11 items-center text-sm text-accent underline"
          >
            {locale === "ru" ? "Войти" : "Sign in"}
          </Link>
        )}
      </div>
    );
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries((await searchParams) ?? {})) {
    if (Array.isArray(value)) for (const part of value) query.append(key, part);
    else if (value !== undefined) query.append(key, value);
  }
  const filters = parseOrganizationTeamQuery(query);
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
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href={`/workspace/organizations/${encodeURIComponent(id)}`}
        className="inline-flex min-h-11 items-center text-sm text-accent underline"
      >
        {copy.workspace}
      </Link>
      <header className="space-y-2">
        <h1 className="text-2xl font-extrabold text-primary">{copy.title}</h1>
        {parsed.success && (
          <p className="break-words font-semibold text-primary">{parsed.data.organization.name}</p>
        )}
        <p className="text-sm text-muted">{copy.description}</p>
      </header>
      {parsed.success && filters && (
        <>
          <form
            action={organizationTeamHref(id, { query: "" })}
            method="get"
            className="nexus-panel flex flex-wrap items-end gap-3 p-4"
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
            <label className="space-y-1 text-xs text-muted">
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
            <label className="space-y-1 text-xs text-muted">
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
            <button
              type="submit"
              className="min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-white"
            >
              {team.filter}
            </button>
            <Link
              href={organizationTeamHref(id, { query: "" })}
              className="inline-flex min-h-11 items-center text-sm text-accent underline"
            >
              {copy.reset}
            </Link>
          </form>
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
        <div className="nexus-panel space-y-3 p-5">
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
          <a
            href={organizationTeamHref(id, filters ?? { query: "" })}
            className="inline-flex min-h-11 items-center text-sm text-accent underline"
          >
            {team.reload}
          </a>
        </div>
      )}
    </div>
  );
}
