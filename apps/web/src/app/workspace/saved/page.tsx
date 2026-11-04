import { ErrorState } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { FollowWorkspace } from "../../../components/follow-workspace";
import { PlatformSignIn } from "../../../components/platform-sign-in";
import { FOLLOW_TYPES, type FollowTargetType } from "../../../lib/follow-workspace-contract";
import { followCopy } from "../../../lib/follow-workspace-copy";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";
import { authService } from "../../../lib/services/auth-service";
import { followWorkspaceService } from "../../../lib/services/follow-workspace-service";
export const dynamic = "force-dynamic";

const pageShellClass = "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8";
const retryLinkClass =
  "inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export async function generateMetadata() {
  const copy = followCopy(await getRequestLocale());
  return {
    title: copy.title,
    description: copy.description,
    robots: { index: false, follow: false },
  };
}
export default async function SavedPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale();
  const copy = followCopy(locale);
  const dictionary = getDictionary(locale);
  const params = await searchParams;
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const returnParams = new URLSearchParams();
  const requestedType = first(params?.type);
  const requestedQuery = first(params?.q);
  if (requestedType) returnParams.set("type", requestedType);
  if (requestedQuery) returnParams.set("q", requestedQuery);
  const returnPath = returnParams.size ? `/workspace/saved?${returnParams}` : "/workspace/saved";
  const actor = await authService
    .getSession((await cookies()).get("nexus_session")?.value)
    .catch(() => null);
  if (!actor) return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  const requested = first(params?.type);
  const type = FOLLOW_TYPES.includes(requested as FollowTargetType)
    ? (requested as FollowTargetType)
    : undefined;
  const query = (first(params?.q) ?? "").trim().slice(0, 100);
  const initial = await followWorkspaceService
    .page(actor.id, { type, query, cursor: undefined })
    .catch(() => null);
  if (!initial) {
    return (
      <div className={pageShellClass}>
        <header className="border-b border-base pb-6">
          <h1 id="saved-follows-heading" className="text-2xl font-extrabold text-primary">
            {copy.title}
          </h1>
          <p className="mt-2 text-sm text-muted">{copy.description}</p>
        </header>
        <ErrorState
          title={copy.pageError}
          action={
            <Link href={returnPath} className={retryLinkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  return (
    <div className={pageShellClass}>
      <header className="border-b border-base pb-6">
        <h1 id="saved-follows-heading" className="text-2xl font-extrabold text-primary">
          {copy.title}
        </h1>
        <p className="mt-2 text-sm text-muted">{copy.description}</p>
      </header>
      <FollowWorkspace
        key={`${type}:${query}`}
        initial={initial}
        type={type}
        query={query}
        locale={locale}
        sectionLabelledBy="saved-follows-heading"
      />
    </div>
  );
}
