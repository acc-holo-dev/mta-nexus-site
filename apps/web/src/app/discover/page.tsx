import Link from "next/link";
import {
  Building2,
  Code2,
  Compass,
  FileText,
  Server as ServerIcon,
  ShoppingBag,
} from "lucide-react";
import { DirectoryFilters, DirectoryResults } from "../../components/discovery-directory";
import {
  DISCOVER_TYPES,
  discoverHref,
  parseDiscoverQuery,
  type DiscoverType,
} from "../../lib/discover-query";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n-server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const copy = getDictionary(await getRequestLocale()).discover;
  return { title: copy.title, description: copy.description };
}

const ICONS = {
  servers: ServerIcon,
  resources: ShoppingBag,
  creators: Code2,
  organizations: Building2,
  content: FileText,
} satisfies Record<DiscoverType, typeof ServerIcon>;

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string | string[];
    q?: string | string[];
    [key: string]: string | string[] | undefined;
  }>;
}) {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const copy = dictionary.discover;
  const state = parseDiscoverQuery(await searchParams);
  const { type, query } = state;
  const results = await DirectoryResults({ state, locale });

  return (
    <div className="space-y-7">
      <div className="border-b border-base pb-6">
        <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-primary sm:text-3xl">
          <Compass className="h-7 w-7 text-accent" aria-hidden="true" />
          <span>{copy.title}</span>
        </h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">{copy.description}</p>
      </div>

      <nav
        aria-label={copy.tabsLabel}
        className="flex items-center gap-1 overflow-x-auto border-b border-base"
      >
        {DISCOVER_TYPES.map((item) => {
          const Icon = ICONS[item];
          const active = item === type;
          return (
            <Link
              key={item}
              href={discoverHref({ type: item, query })}
              aria-current={active ? "page" : undefined}
              className={`-mb-px inline-flex min-h-11 items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-accent ${
                active
                  ? "border-accent text-accent"
                  : "border-transparent text-muted hover:text-primary"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {copy[item]}
            </Link>
          );
        })}
      </nav>

      <DirectoryFilters state={state} locale={locale} />
      {results}
    </div>
  );
}
