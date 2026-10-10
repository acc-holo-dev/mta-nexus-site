import { cookies } from "next/headers";
import Link from "next/link";
import { VerificationWorkspace } from "../../../components/verification-workspace";
import { authService } from "../../../lib/services/auth-service";
import { verificationWorkspaceService } from "../../../lib/services/verification-workspace-service";
import { getRequestLocale } from "../../../lib/i18n-server";
import { verificationCopy } from "../../../lib/verification-workspace-copy";
import {
  verificationPageQuery,
  verificationOverviewSchema,
  verificationTargetsSchema,
} from "../../../lib/verification-workspace-contract";
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
} = {}) {
  const locale = await getRequestLocale(),
    copy = verificationCopy(locale),
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  if (!actor)
    return (
      <div className="nexus-panel space-y-4 p-8">
        <h1 className="text-xl font-bold text-primary">{copy.title}</h1>
        <Link className="text-accent underline" href="/auth/login">
          {copy.signIn}
        </Link>
      </div>
    );
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
