import type { ReactNode } from "react";
import { getDictionary, type Locale } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { HonestLoadingShell } from "../honest-loading";
import { pageShellStack6 } from "../page-shell";
import { skelH20, skelPulseSpace4 } from "../skeleton-shell";

type Dictionary = ReturnType<typeof getDictionary>;

const DEFAULT_CLASS = pageShellStack6;
const DEFAULT_ROW = skelH20;

function RouteHonestLoading({
  headingId,
  title,
  description,
  loadingLabel,
  className = DEFAULT_CLASS,
  headerClassName,
  titleClassName,
  statusClassName,
  headingLevel = 1,
  rows = 3,
  rowClassName = DEFAULT_ROW,
  leading,
}: {
  headingId: string;
  title: ReactNode;
  description?: ReactNode;
  loadingLabel: ReactNode;
  className?: string;
  headerClassName?: string;
  titleClassName?: string;
  statusClassName?: string;
  headingLevel?: 1 | 2;
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
      {...(description !== undefined ? { description } : {})}
      loadingLabel={loadingLabel}
      headingLevel={headingLevel}
      {...(headerClassName ? { headerClassName } : {})}
      {...(titleClassName ? { titleClassName } : {})}
      {...(statusClassName ? { statusClassName } : {})}
    >
      <div className={skelPulseSpace4} aria-hidden="true">
        {leading}
        {keys.map((key) => (
          <div key={key} className={rowClassName} />
        ))}
      </div>
    </HonestLoadingShell>
  );
}

function readDictionaryPath(dictionary: Dictionary, path: string): ReactNode {
  let current: unknown = dictionary;
  for (const part of path.split(".")) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current as ReactNode;
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
  pick: (
    dictionary: Dictionary,
    locale: Locale,
  ) => {
    title: ReactNode;
    loading: ReactNode;
    description?: ReactNode;
  };
}) {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const copy = pick(dictionary, locale);
  return (
    <RouteHonestLoading
      headingId={headingId}
      title={copy.title}
      {...(copy.description !== undefined ? { description: copy.description } : {})}
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

export async function DictionaryFieldRouteLoading({
  headingId,
  titlePath,
  loadingPath,
  className = DEFAULT_CLASS,
  headerClassName,
  titleClassName,
  statusClassName,
  rows = 3,
  rowClassName = DEFAULT_ROW,
  leading,
}: {
  headingId: string;
  titlePath: string;
  loadingPath: string;
  className?: string;
  headerClassName?: string;
  titleClassName?: string;
  statusClassName?: string;
  rows?: number;
  rowClassName?: string;
  leading?: ReactNode;
}) {
  return DictionaryRouteLoading({
    headingId,
    className,
    headerClassName,
    titleClassName,
    statusClassName,
    rows,
    rowClassName,
    leading,
    pick: (dictionary) => ({
      title: readDictionaryPath(dictionary, titlePath),
      loading: readDictionaryPath(dictionary, loadingPath),
    }),
  });
}

export async function LocaleCopyRouteLoading({
  headingId,
  className = DEFAULT_CLASS,
  headerClassName,
  titleClassName,
  statusClassName,
  rows = 3,
  rowClassName = DEFAULT_ROW,
  leading,
  load,
}: {
  headingId: string;
  className?: string;
  headerClassName?: string;
  titleClassName?: string;
  statusClassName?: string;
  rows?: number;
  rowClassName?: string;
  leading?: ReactNode;
  load: (locale: Locale) => {
    title: ReactNode;
    loading: ReactNode;
    description?: ReactNode;
  };
}) {
  const copy = load(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId={headingId}
      title={copy.title}
      {...(copy.description !== undefined ? { description: copy.description } : {})}
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
