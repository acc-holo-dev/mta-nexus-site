import type { ReactNode } from "react";

const DEFAULT_HEADER_CLASS = "space-y-2";
const DEFAULT_TITLE_CLASS = "font-display text-primary";
const DEFAULT_STATUS_CLASS = "text-sm text-muted";

export function HonestLoadingShell({
  className,
  headingId,
  title,
  loadingLabel,
  headerClassName = DEFAULT_HEADER_CLASS,
  titleClassName = DEFAULT_TITLE_CLASS,
  statusClassName = DEFAULT_STATUS_CLASS,
  leading,
  children,
}: {
  className?: string;
  headingId: string;
  title: ReactNode;
  loadingLabel: ReactNode;
  headerClassName?: string;
  titleClassName?: string;
  statusClassName?: string;
  leading?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className={className} aria-busy="true" aria-labelledby={headingId}>
      {leading}
      <header {...(headerClassName ? { className: headerClassName } : {})}>
        <h1 id={headingId} className={titleClassName}>
          {title}
        </h1>
        <p role="status" aria-live="polite" className={statusClassName}>
          {loadingLabel}
        </p>
      </header>
      {children}
    </section>
  );
}
