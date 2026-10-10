import { DirectoryFilters, DirectoryResults } from "../../components/discovery-directory";
import { parseDiscoverQuery } from "../../lib/discover-query";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n-server";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const locale = await getRequestLocale();
  const copy = getDictionary(locale).developers;
  return { title: copy.title, description: copy.description };
}
export default async function DevelopersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
} = {}) {
  const locale = await getRequestLocale();
  const copy = getDictionary(locale).developers;
  const state = parseDiscoverQuery({ ...(await searchParams), type: "creators" });
  const results = await DirectoryResults({ state, locale, path: "/developers" });
  return (
    <div className="space-y-6">
      <header className="border-b border-base pb-6">
        <h1 className="text-2xl font-extrabold text-primary">{copy.title}</h1>
        <p className="mt-2 text-sm text-muted">{copy.description}</p>
      </header>
      <DirectoryFilters state={state} locale={locale} path="/developers" />
      {results}
    </div>
  );
}
