import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { verificationWorkspaceService } from "../../../lib/services/moderation/verification-workspace-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { pageShellMax5xl as pageShellClass } from "../../shell/page-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { type2xlBoldPrimary, typeMt2SmMuted } from "../../shell/type-shell";
import {
  verificationOverviewSchema,
  verificationPageQuery,
  verificationTargetsSchema,
} from "../../trust/verification-workspace-contract";
import { verificationCopy } from "../../trust/verification-workspace-copy";
import { VerificationWorkspace } from "../verification-workspace";

export async function verificationWorkspaceMetadata(): Promise<Metadata> {
  return {
    title: verificationCopy(await getRequestLocale()).title,
    robots: { index: false, follow: false },
  };
}

export async function VerificationWorkspacePage({
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
      <PlatformSessionError
        locale={locale}
        title={copy.title}
        message={copy.unavailable}
        retryHref={"/workspace/verification"}
      />
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
        <h1 className={type2xlBoldPrimary}>{copy.title}</h1>
        <p className={typeMt2SmMuted}>{copy.description}</p>
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
