import Link from "next/link";
import { cookies } from "next/headers";
import { FollowWorkspace } from "../../../components/follow-workspace";
import { authService } from "../../../lib/services/auth-service";
import { followWorkspaceService } from "../../../lib/services/follow-workspace-service";
import { FOLLOW_TYPES, type FollowTargetType } from "../../../lib/follow-workspace-contract";
import { followCopy } from "../../../lib/follow-workspace-copy";
import { getRequestLocale } from "../../../lib/i18n-server";
export const dynamic = "force-dynamic";
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
} = {}) {
  const locale = await getRequestLocale();
  const copy = followCopy(locale);
  const actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  if (!actor)
    return (
      <div className="nexus-panel mx-auto max-w-md space-y-4 p-8 text-center">
        <h1 className="text-xl font-bold text-primary">{copy.title}</h1>
        <Link
          href="/auth/login"
          className="inline-flex min-h-11 items-center rounded-lg bg-accent px-4 text-sm text-white"
        >
          {copy.signIn}
        </Link>
      </div>
    );
  const params = await searchParams;
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const requested = first(params?.type);
  const type = FOLLOW_TYPES.includes(requested as FollowTargetType)
    ? (requested as FollowTargetType)
    : undefined;
  const query = (first(params?.q) ?? "").trim().slice(0, 100);
  const initial = await followWorkspaceService
    .page(actor.id, { type, query, cursor: undefined })
    .catch(() => null);
  return (
    <div className="space-y-6">
      <header className="border-b border-base pb-6">
        <h1 className="text-2xl font-extrabold text-primary">{copy.title}</h1>
        <p className="mt-2 text-sm text-muted">{copy.description}</p>
      </header>
      <FollowWorkspace
        key={`${type}:${query}`}
        initial={initial}
        type={type}
        query={query}
        locale={locale}
      />
    </div>
  );
}
