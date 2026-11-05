import { ErrorState } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { PlatformSignIn } from "../../../components/platform-sign-in";
import { VerificationWorkspace } from "../../../components/verification-workspace";
import { getDictionary } from "../../../lib/i18n";
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

const pageShellClass = "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

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
    copy = verificationCopy(locale),
    dictionary = getDictionary(locale);
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  } catch {
    return (
      <div className={pageShellClass}>
        <header>
          <h1 className="text-2xl font-bold text-primary">{copy.title}</h1>
          <p className="mt-2 text-sm text-muted">{copy.description}</p>
        </header>
        <ErrorState
          title={copy.unavailable}
          action={
            <Link href="/workspace/verification" className={navLinkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
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
    return <PlatformSignIn locale={locale} returnPath={returnPath} />;
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
    <div className={pageShellClass}>
      <header>
        <h1 className="text-2xl font-bold text-primary">{copy.title}</h1>
        <p className="mt-2 text-sm text-muted">{copy.description}</p>
      </header>
      <VerificationWorkspace
        key={`${actor.id}:${JSON.stringify(filters)}:${JSON.stringify(teamFilters)}`}
        actorId={actor.id}
        initial={initial}
        initialTeams={initialTeams}
        filters={filters}
        teamFilters={teamFilters}
        locale={locale}
      />
    </div>
  );
}
