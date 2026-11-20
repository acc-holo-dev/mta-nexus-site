import type { ReactNode } from "react";
import { getDictionary, type Locale } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { HonestLoadingShell } from "../honest-loading";

type Dictionary = ReturnType<typeof getDictionary>;

const DEFAULT_CLASS = "min-w-0 space-y-6 overflow-x-clip";
const DEFAULT_ROW = "h-20 rounded bg-inset";

export function RouteHonestLoading({
  headingId,
  title,
  loadingLabel,
  className = DEFAULT_CLASS,
  headerClassName,
  titleClassName,
  statusClassName,
  rows = 3,
  rowClassName = DEFAULT_ROW,
  leading,
}: {
  headingId: string;
  title: ReactNode;
  loadingLabel: ReactNode;
  className?: string;
  headerClassName?: string;
  titleClassName?: string;
  statusClassName?: string;
  rows?: number;
  rowClassName?: string;
  leading?: ReactNode;
}) {
  const keys = Array.from({ length: rows }, (_, index) => index + 1);
  return (
    <HonestLoadingShell
      className={className}
      headingId={headingId}
      title={title}
      loadingLabel={loadingLabel}
      {...(headerClassName ? { headerClassName } : {})}
      {...(titleClassName ? { titleClassName } : {})}
      {...(statusClassName ? { statusClassName } : {})}
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        {leading}
        {keys.map((key) => (
          <div key={key} className={rowClassName} />
        ))}
      </div>
    </HonestLoadingShell>
  );
}

export async function DictionaryRouteLoading({
  headingId,
  className = DEFAULT_CLASS,
  headerClassName,
  titleClassName,
  statusClassName,
  rows = 3,
  rowClassName = DEFAULT_ROW,
  leading,
  pick,
}: {
  headingId: string;
  className?: string;
  headerClassName?: string;
  titleClassName?: string;
  statusClassName?: string;
  rows?: number;
  rowClassName?: string;
  leading?: ReactNode;
  pick: (dictionary: Dictionary, locale: Locale) => { title: ReactNode; loading: ReactNode };
}) {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const copy = pick(dictionary, locale);
  return (
    <RouteHonestLoading
      headingId={headingId}
      title={copy.title}
      loadingLabel={copy.loading}
      className={className}
      headerClassName={headerClassName}
      titleClassName={titleClassName}
      statusClassName={statusClassName}
      rows={rows}
      rowClassName={rowClassName}
      leading={leading}
    />
  );
}
