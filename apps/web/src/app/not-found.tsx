import Link from "next/link";
import { SearchX, Home, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="max-w-lg mx-auto py-20 text-center space-y-5">
      <div className="w-14 h-14 rounded-xl bg-accent-soft text-accent flex items-center justify-center mx-auto">
        <SearchX className="w-7 h-7" />
      </div>

      <div className="space-y-2">
        <h1 className="font-display text-primary">Page not found</h1>
        <p className="font-caption text-muted max-w-sm mx-auto leading-relaxed">
          The page you are looking for doesn&apos;t exist or may have been moved. Try searching
          the marketplace or exploring the ecosystem instead.
        </p>
      </div>

      <div className="flex items-center justify-center gap-3">
        <Link
          href="/market"
          className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-accent hover:bg-[var(--nexus-accent-hover)] text-white text-xs font-semibold transition-colors"
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Explore Marketplace</span>
        </Link>
        <Link
          href="/"
          className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-elevated border border-base text-secondary hover:text-primary text-xs font-semibold transition-colors"
        >
          <Home className="w-3.5 h-3.5" />
          <span>Go Home</span>
        </Link>
      </div>
    </div>
  );
}
