import Link from "next/link";
import type { ReverseDependencySummary } from "../lib/reverse-dependency-summary";

export function ReverseDependencyList({
  summary,
}: {
  summary: ReverseDependencySummary | null;
}) {
  if (!summary) {
    return (
      <p className="text-xs text-amber-300">
        Reverse dependency lookup is temporarily unavailable.
      </p>
    );
  }

  if (summary.products.length === 0) {
    return (
      <p className="text-xs text-neutral-500">
        No published free NEXUS resources currently declare this resource as a
        direct dependency.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {summary.products.map((product) => (
          <Link
            key={product.id}
            href={`/market/${product.slug}`}
            className="rounded-md border border-base bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-300 hover:border-blue-500/50 hover:text-blue-300"
          >
            <span className="font-semibold">{product.title}</span>
            <span className="ml-1 font-mono text-[10px] text-neutral-500">
              v{product.currentVersion}
            </span>
          </Link>
        ))}
      </div>
      {summary.limitReached && (
        <p className="text-[10px] text-amber-300">
          Showing the first 50 published direct dependents. More relationships
          exist than this beta surface displays.
        </p>
      )}
      <p className="text-[10px] text-neutral-500">
        Direct declarations only. This does not imply runtime compatibility or
        successful installation.
      </p>
    </div>
  );
}
