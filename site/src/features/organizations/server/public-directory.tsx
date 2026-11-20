import { getRequestLocale } from "../../../lib/i18n/server";
import { DirectoryFilters, DirectoryResults } from "../../discovery/directory-server";
import { parseDiscoverQuery } from "../../discovery/discover-query";
import { discoveryCopy } from "../../discovery/discovery-copy";
import { pageShellStack6 } from "../../shell/page-shell";
import { type2xlExtraboldPrimary, typeMt2SmMuted } from "../../shell/type-shell";
export async function organizationsMetadata() {
  const copy = discoveryCopy(await getRequestLocale());
  return { title: copy.organizationsTitle, description: copy.organizationsDescription };
}
export async function OrganizationsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale();
  const copy = discoveryCopy(locale);
  const state = parseDiscoverQuery({ ...(await searchParams), type: "organizations" });
  const results = await DirectoryResults({ state, locale, path: "/organizations" });
  return (
    <div className={pageShellStack6}>
      <header className="border-b border-base pb-6">
        <h1 className={type2xlExtraboldPrimary}>{copy.organizationsTitle}</h1>
        <p className={typeMt2SmMuted}>{copy.organizationsDescription}</p>
      </header>
      <DirectoryFilters state={state} locale={locale} path="/organizations" />
      {results}
    </div>
  );
}
