import { Button, EmptyState, ErrorState } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { platformSignInFocusClass } from "../../../components/guest-auth-links";
import { PlatformSignIn } from "../../../components/platform-sign-in";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";
import { parseOrganizationPage } from "../../../lib/organization-workspace-contract";
import { getOrganizationCopy } from "../../../lib/organization-workspace-copy";
import { authService } from "../../../lib/services/auth-service";
import { organizationWorkspaceService } from "../../../lib/services/organization-workspace-service";
import { platformFieldClass } from "../../../lib/user-platform-client";
export const dynamic = "force-dynamic";
const pageShellClass = "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";
export async function generateMetadata() {
  return {
    title: getOrganizationCopy(await getRequestLocale()).title,
    robots: { index: false, follow: false },
  };
}
export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, store, query] = await Promise.all([getRequestLocale(), cookies(), searchParams]);
  const actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor) return <PlatformSignIn locale={locale} returnPath="/workspace/organizations" />;
  const copy = getOrganizationCopy(locale);
  const dictionary = getDictionary(locale);
  const filters = parseOrganizationPage(query);
  const result = await organizationWorkspaceService
    .list(actor, filters.page, filters.query)
    .catch(() => null);
  const href = (page: number) => {
    const params = new URLSearchParams();
    if (filters.query) params.set("q", filters.query);
    if (page > 1) params.set("page", String(page));
    return `/workspace/organizations${params.size ? `?${params}` : ""}`;
  };
  return (
    <div className={pageShellClass}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-primary">{copy.title}</h1>
          <p className="mt-2 text-sm text-muted">{copy.description}</p>
        </div>
        <Link
          className={`inline-flex min-h-11 items-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white ${platformSignInFocusClass}`}
          href="/workspace/organizations/new"
        >
          {copy.create}
        </Link>
      </header>
      <search aria-label={copy.search}>
        <form action="/workspace/organizations" className="flex flex-wrap items-end gap-3">
          <label className="min-w-0 flex-1 space-y-1 text-sm text-secondary">
            <span>{copy.search}</span>
            <input
              className={`${platformFieldClass} min-h-11`}
              type="search"
              name="q"
              maxLength={120}
              defaultValue={filters.query}
            />
          </label>
          <Button type="submit" variant="outline" className="min-h-11 text-sm text-secondary">
            {copy.filter}
          </Button>
        </form>
      </search>
      {!result ? (
        <ErrorState
          title={copy.unavailable}
          action={
            <Link href={href(filters.page)} className={navLinkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      ) : (
        <>
          {result.items.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {result.items.map((item) => (
                <article className="nexus-panel space-y-3 p-5" key={item.id}>
                  <h2 className="break-words font-heading text-primary">{item.name}</h2>
                  <p className="text-xs text-muted">
                    @{item.slug} ·{" "}
                    {item.role in copy
                      ? copy[item.role as "owner" | "admin" | "member" | "developer"]
                      : item.role}
                  </p>
                  <p className="line-clamp-3 text-sm text-secondary">{item.description}</p>
                  <Link
                    className={navLinkClass}
                    href={`/workspace/organizations/${encodeURIComponent(item.id)}`}
                  >
                    {copy.open}
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title={filters.query ? copy.emptyFiltered : copy.empty}
              description={filters.query ? copy.emptyFilteredHint : copy.emptyHint}
              action={
                filters.query ? (
                  <Link href="/workspace/organizations" className={navLinkClass}>
                    {copy.clearSearch}
                  </Link>
                ) : (
                  <Link href="/workspace/organizations/new" className={navLinkClass}>
                    {copy.create}
                  </Link>
                )
              }
            />
          )}
          <nav className="flex justify-between text-sm" aria-label={copy.title}>
            {result.page > 1 ? (
              <Link className={navLinkClass} href={href(result.page - 1)}>
                {copy.previous}
              </Link>
            ) : (
              <span />
            )}
            <span className="inline-flex min-h-11 items-center">
              {copy.page} {result.page}
            </span>
            {result.hasMore && (
              <Link className={navLinkClass} href={href(result.page + 1)}>
                {copy.next}
              </Link>
            )}
          </nav>
        </>
      )}
    </div>
  );
}
