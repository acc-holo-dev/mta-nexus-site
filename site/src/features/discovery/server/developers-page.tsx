import type { Metadata } from "next";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { pageShellStack6 } from "../../shell/page-shell";
import { surfaceBorderBPb6 } from "../../shell/surface-shell";
import { type2xlExtraboldPrimary, typeMt2SmMuted } from "../../shell/type-shell";
import { DirectoryFilters, DirectoryResults } from "../directory-server";
import { parseDiscoverQuery } from "../discover-query";

export async function developersMetadata(): Promise<Metadata> {
  const copy = getDictionary(await getRequestLocale()).developers;
  return { title: copy.title, description: copy.description };
}

export async function DevelopersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale();
  const copy = getDictionary(locale).developers;
  const state = parseDiscoverQuery({ ...(await searchParams), type: "creators" });
  const results = await DirectoryResults({ state, locale, path: "/developers" });
  return (
    <div className={pageShellStack6}>
      <header className={surfaceBorderBPb6}>
        <h1 className={type2xlExtraboldPrimary}>{copy.title}</h1>
        <p className={typeMt2SmMuted}>{copy.description}</p>
      </header>
      <DirectoryFilters state={state} locale={locale} path="/developers" />
      {results}
    </div>
  );
}
