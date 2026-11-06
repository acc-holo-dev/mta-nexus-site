import { can } from "@nexus/security";
import { ErrorState } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { getDictionary } from "../lib/i18n";
import { getRequestLocale } from "../lib/i18n-server";
import { authService } from "../lib/services/auth-service";
import { supportQuery } from "../lib/support-workspace-contract";
import { supportWorkspaceCopy } from "../lib/support-workspace-copy";
import { PlatformGuestAuthPanel } from "./platform-guest-auth-panel";
import { PlatformSignIn } from "./platform-sign-in";
import { SupportCaseThread } from "./support-case-thread";
import { SupportCenter } from "./support-center";

export async function supportMetadata(staff = false) {
  const copy = getDictionary(await getRequestLocale()).support;
  return { title: staff ? copy.staffQueue : copy.title, robots: { index: false, follow: false } };
}

export async function SupportPageSurface({
  searchParams,
  staff = false,
  id,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
  staff?: boolean;
  id?: string;
}) {
  const locale = await getRequestLocale(),
    copy = supportWorkspaceCopy(locale),
    dictionary = getDictionary(locale),
    support = dictionary.support;
  const base = staff ? "/admin/support" : "/support";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries((await searchParams) ?? {})) {
    if (Array.isArray(value)) for (const item of value) params.append(key, item);
    else if (value !== undefined) params.append(key, value);
  }
  const listReturnPath = params.size ? `${base}?${params}` : base;
  const store = await cookies(),
    actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor) {
    // Case detail uses the shared gate; the list keeps the Support H1 shell a11y asserts.
    if (id !== undefined) return <PlatformSignIn locale={locale} returnPath={`${base}/${id}`} />;
    return (
      <div className="mx-auto min-w-0 max-w-5xl space-y-8 overflow-x-clip">
        <header className="space-y-2 border-b border-base pb-6">
          <h1 className="font-display text-primary">{support.title}</h1>
          <p className="max-w-3xl text-sm text-muted">{support.description}</p>
          <ErrorState id="support-no-guaranteed-sla" title={support.noGuaranteedSla} />
        </header>
        <PlatformGuestAuthPanel locale={locale} returnPath={listReturnPath} />
      </div>
    );
  }
  if (staff && !can(actor, "admin.moderation"))
    return (
      <div className="mx-auto min-w-0 max-w-5xl overflow-x-clip">
        <ErrorState
          id="support-forbidden"
          title={copy.forbidden}
          action={
            <Link
              href="/support"
              className="inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {support.title}
            </Link>
          }
        />
      </div>
    );
  if (id !== undefined)
    return /^sup_[a-f0-9]{24}$/u.test(id) ? (
      <SupportCaseThread
        key={`${actor.id}:${id}`}
        caseId={id}
        staffMode={staff}
        actorId={actor.id}
      />
    ) : (
      <div className="mx-auto min-w-0 max-w-5xl space-y-4 overflow-x-clip">
        <ErrorState
          title={copy.notFound}
          action={
            <Link
              href={base}
              className="inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {support.back}
            </Link>
          }
        />
      </div>
    );
  const filters = supportQuery(params);
  if (!filters)
    return (
      <div className="mx-auto min-w-0 max-w-5xl space-y-4 overflow-x-clip">
        <ErrorState
          title={copy.queryInvalid}
          action={
            <Link
              href={base}
              className="inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {copy.reset}
            </Link>
          }
        />
      </div>
    );
  return (
    <SupportCenter
      staffMode={staff}
      actorId={actor.id}
      initialFilters={filters}
      initialDraft={
        filters.draft === "publication" && filters.subject
          ? { category: "other", subject: filters.subject }
          : null
      }
      key={`${actor.id}:${params.toString()}`}
    />
  );
}
