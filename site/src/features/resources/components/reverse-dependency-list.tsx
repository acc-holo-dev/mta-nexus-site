import { EmptyState, ErrorState } from "@nexus/ui";
import { GitBranch } from "lucide-react";
import Link from "next/link";
import { getDictionary, type Locale } from "../../../lib/i18n";
import { typeFlexWrapGap2, typeTenFaint } from "../../shell/type-shell";
import type { ReverseDependencySummary } from "../reverse-dependency-summary";

export function ReverseDependencyList({
  summary,
  locale = "en",
  walletEnabled = false,
}: {
  summary: ReverseDependencySummary | null;
  locale?: Locale;
  /** When the wallet engine is on, empty copy must not claim only free resources are searched. */
  walletEnabled?: boolean;
}) {
  const copy = getDictionary(locale).dependencyUi;

  if (!summary) {
    return <ErrorState title={copy.reverseUnavailable} description={copy.reverseUnavailableHint} />;
  }

  if (summary.products.length === 0) {
    return (
      <EmptyState
        title={walletEnabled ? copy.noDependentsWallet : copy.noDependents}
        description={copy.reverseNotice}
        icon={<GitBranch className="h-6 w-6" aria-hidden="true" />}
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className={typeFlexWrapGap2}>
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
      {summary.limitReached ? (
        <ErrorState
          id="reverse-deps-limit-reached"
          title={copy.limitReached}
          description={copy.limitReachedHint}
        />
      ) : null}
      <p className={typeTenFaint}>{copy.reverseNotice}</p>
    </div>
  );
}
