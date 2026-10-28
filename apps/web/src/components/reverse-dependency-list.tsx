import Link from "next/link";
import type { ReverseDependencySummary } from "../lib/reverse-dependency-summary";
import { getDictionary, type Locale } from "../lib/i18n";

export function ReverseDependencyList({
  summary,
  locale = "en",
}: {
  summary: ReverseDependencySummary | null;
  locale?: Locale;
}) {
  const copy = getDictionary(locale).dependencyUi;

  if (!summary) {
    return <p className="text-xs text-warning">{copy.reverseUnavailable}</p>;
  }

  if (summary.products.length === 0) {
    return <p className="text-xs text-faint">{copy.noDependents}</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {summary.products.map((product) => (
          <Link
            key={product.id}
            href={`/market/${product.slug}`}
            className="rounded-md border border-base bg-inset px-2.5 py-1.5 text-xs text-secondary transition-colors hover:border-strong hover:text-accent"
          >
            <span className="font-semibold">{product.title}</span>
            <span className="ml-1 font-mono text-[10px] text-faint">v{product.currentVersion}</span>
          </Link>
        ))}
      </div>
      {summary.limitReached && <p className="text-[10px] text-warning">{copy.limitReached}</p>}
      <p className="text-[10px] text-faint">{copy.reverseNotice}</p>
    </div>
  );
}
