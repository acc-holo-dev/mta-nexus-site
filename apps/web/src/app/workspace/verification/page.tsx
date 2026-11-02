import { cookies } from "next/headers";
import Link from "next/link";
import { authEntryHref } from "../../../components/auth-return-path";
import { VerificationWorkspace } from "../../../components/verification-workspace";
import { getRequestLocale } from "../../../lib/i18n-server";
import { authService } from "../../../lib/services/auth-service";
import { verificationWorkspaceService } from "../../../lib/services/verification-workspace-service";
import {
  verificationOverviewSchema,
  verificationPageQuery,
  verificationTargetsSchema,
} from "../../../lib/verification-workspace-contract";
import { verificationCopy } from "../../../lib/verification-workspace-copy";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return {
    title: verificationCopy(await getRequestLocale()).title,
    robots: { index: false, follow: false },
  };
}
export default async function VerificationPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale(),
    copy = verificationCopy(locale);
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  } catch {
    return (
      <p role="alert" className="nexus-panel p-6 text-sm text-danger">
        {copy.unavailable}
      </p>
    );
  }
  if (!actor) {
    const query = await searchParams;
    const returnParams = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) {
      if (Array.isArray(value)) for (const part of value) returnParams.append(key, part);
      else if (value !== undefined) returnParams.append(key, value);
    }
    const returnPath = returnParams.size
      ? `/workspace/verification?${returnParams}`
      : "/workspace/verification";
    return (
      <div className="nexus-panel space-y-4 p-8">
        <h1 className="text-xl font-bold text-primary">{copy.title}</h1>
        <Link
          className="rounded text-accent underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          href={authEntryHref("login", returnPath)}
        >
          {copy.signIn}
        </Link>
      </div>
    );
  }
  const query = await searchParams,
    filters = verificationPageQuery(query),
    teamFilters = verificationPageQuery({ page: query?.teamsPage, q: query?.teamsQ }, true);
  const [initial, initialTeams] = await Promise.all([
    verificationWorkspaceService
      .overview(actor, filters)
      .then((value) => verificationOverviewSchema.parse(value))
      .catch(() => null),
    verificationWorkspaceService
      .targets(actor, teamFilters)
      .then((value) => verificationTargetsSchema.parse(value))
      .catch(() => null),
  ]);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-primary">{copy.title}</h1>
        <p className="mt-2 text-sm text-muted">{copy.description}</p>
      </header>
      <VerificationWorkspace
        key={`${actor.id}:${JSON.stringify(filters)}:${JSON.stringify(teamFilters)}`}
        initial={initial}
        initialTeams={initialTeams}
        filters={filters}
        teamFilters={teamFilters}
        locale={locale}
      />
    </div>
  );
}
