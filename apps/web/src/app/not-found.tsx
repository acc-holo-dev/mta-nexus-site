import Link from "next/link";
import { Compass, Home, SearchX } from "lucide-react";
import { getDictionary } from "../lib/i18n";
import { getRequestLocale } from "../lib/i18n-server";

export default async function NotFound() {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);

  return (
    <div className="mx-auto max-w-lg space-y-5 py-20 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-accent-soft text-accent">
        <SearchX className="h-7 w-7" />
      </div>
      <div className="space-y-2">
        <h1 className="font-display text-primary">
          {dictionary.errors.notFoundTitle}
        </h1>
        <p className="mx-auto max-w-sm font-caption leading-relaxed text-muted">
          {dictionary.errors.notFoundMessage}
        </p>
      </div>
      <div className="flex items-center justify-center gap-3">
        <Link
          href="/market"
          className="flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
        >
          <Compass className="h-3.5 w-3.5" />
          <span>{dictionary.errors.resourceLibrary}</span>
        </Link>
        <Link
          href="/"
          className="flex items-center gap-1.5 rounded-md border border-base bg-elevated px-4 py-2 text-xs font-semibold text-secondary transition-colors hover:bg-hover hover:text-primary"
        >
          <Home className="h-3.5 w-3.5" />
          <span>{dictionary.errors.home}</span>
        </Link>
      </div>
    </div>
  );
}
