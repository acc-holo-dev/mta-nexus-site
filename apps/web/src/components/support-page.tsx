import { can } from "@nexus/security";
import { cookies } from "next/headers";
import Link from "next/link";
import { getDictionary } from "../lib/i18n";
import { getRequestLocale } from "../lib/i18n-server";
import { authService } from "../lib/services/auth-service";
import { supportQuery } from "../lib/support-workspace-contract";
import { supportWorkspaceCopy } from "../lib/support-workspace-copy";
import { authEntryHref } from "./auth-return-path";
import { PlatformSignIn } from "./content-catalog-controls";
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
    support = dictionary.support,
    workspace = dictionary.workspace;
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
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-2 border-b border-base pb-6">
          <h1 className="font-display text-primary">{support.title}</h1>
          <p className="max-w-3xl text-sm text-muted">{support.description}</p>
          <p className="text-xs text-warning">{support.noGuaranteedSla}</p>
        </header>
        <div className="nexus-panel space-y-3 p-5">
          <p className="text-sm text-secondary">{workspace.signInRequired}</p>
          {workspace.signInMessage ? (
            <p className="text-sm text-secondary">{workspace.signInMessage}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href={authEntryHref("login", listReturnPath)}
              className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-sm font-medium text-white underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {workspace.signIn}
            </Link>
            <Link
              href={authEntryHref("register", listReturnPath)}
              className="inline-flex min-h-11 items-center text-sm text-secondary underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {workspace.createAccount}
            </Link>
          </div>
        </div>
      </div>
    );
  }
  if (staff && !can(actor, "admin.moderation"))
    return (
      <p role="alert" className="nexus-panel p-5 text-danger">
        {copy.forbidden}
      </p>
    );
  if (id !== undefined)
    return /^sup_[a-f0-9]{24}$/u.test(id) ? (
      <SupportCaseThread caseId={id} staffMode={staff} />
    ) : (
      <p role="alert" className="nexus-panel p-5 text-danger">
        {copy.notFound}
      </p>
    );
  const filters = supportQuery(params);
  if (!filters)
    return (
      <div className="space-y-3">
        <p role="alert" className="nexus-panel p-5 text-danger">
          {copy.queryInvalid}
        </p>
        <Link
          href={base}
          className="text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {copy.reset}
        </Link>
      </div>
    );
  return <SupportCenter staffMode={staff} initialFilters={filters} key={params.toString()} />;
}
