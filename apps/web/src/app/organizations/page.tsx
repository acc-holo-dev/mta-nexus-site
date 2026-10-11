import { DirectoryFilters, DirectoryResults } from "../../components/discovery-directory";
import { parseDiscoverQuery } from "../../lib/discover-query";
import { discoveryCopy } from "../../lib/discovery-copy";
import { getRequestLocale } from "../../lib/i18n-server";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const copy = discoveryCopy(await getRequestLocale());
  return { title: copy.organizationsTitle, description: copy.organizationsDescription };
}
export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale();
  const copy = discoveryCopy(locale);
  const state = parseDiscoverQuery({ ...(await searchParams), type: "organizations" });
  const results = await DirectoryResults({ state, locale, path: "/organizations" });
  return (
    <div className="space-y-6">
      <header className="border-b border-base pb-6">
        <h1 className="text-2xl font-extrabold text-primary">{copy.organizationsTitle}</h1>
        <p className="mt-2 text-sm text-muted">{copy.organizationsDescription}</p>
      </header>
      <DirectoryFilters state={state} locale={locale} path="/organizations" />
      {results}
    </div>
  );
}
