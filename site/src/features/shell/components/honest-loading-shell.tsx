import type { ReactNode } from "react";
import { typeDisplayPrimary } from "../type-shell";

const DEFAULT_HEADER_CLASS = "space-y-2";
const DEFAULT_TITLE_CLASS = typeDisplayPrimary;
const DEFAULT_STATUS_CLASS = "text-sm text-muted";

export function HonestLoadingShell({
  className,
  headingId,
  title,
  description,
  loadingLabel,
  headerClassName = DEFAULT_HEADER_CLASS,
  titleClassName = DEFAULT_TITLE_CLASS,
  statusClassName = DEFAULT_STATUS_CLASS,
  headingLevel = 1,
  leading,
  children,
}: {
  className?: string;
  headingId: string;
  title: ReactNode;
  description?: ReactNode;
  loadingLabel: ReactNode;
  headerClassName?: string;
  titleClassName?: string;
  statusClassName?: string;
  /** Nested settings/workspace panels use h2; route loaders keep the default h1. */
  headingLevel?: 1 | 2;
  leading?: ReactNode;
  children?: ReactNode;
}) {
  const HeadingTag = headingLevel === 2 ? "h2" : "h1";
  return (
    <section className={className} aria-busy="true" aria-labelledby={headingId}>
      {leading}
      <header {...(headerClassName ? { className: headerClassName } : {})}>
        <HeadingTag id={headingId} className={titleClassName}>
          {title}
        </HeadingTag>
        {description}
        <p role="status" aria-live="polite" className={statusClassName}>
          {loadingLabel}
        </p>
      </header>
      {children}
    </section>
  );
}
