import type { ReactNode } from "react";
import { pageShellMax3xl } from "../page-shell";
import { DictionaryFieldRouteLoading } from "../route-honest-loading-server";

function LegalDocumentRouteLoading({
  headingId,
  titlePath,
  loadingPath = "errors.loading",
  className = pageShellMax3xl,
  headerClassName,
  titleClassName,
  statusClassName,
  rows = 0,
  rowClassName = "h-24 rounded bg-inset",
  leading,
}: {
  headingId: string;
  titlePath: string;
  loadingPath?: string;
  className?: string;
  headerClassName?: string;
  titleClassName?: string;
  statusClassName?: string;
  rows?: number;
  rowClassName?: string;
  leading?: ReactNode | null;
}) {
  const resolvedLeading =
    leading === undefined ? (
      <>
        <div className="h-4 w-40 rounded bg-inset" />
        <div className="h-24 rounded bg-inset" />
        <div className="h-24 rounded bg-inset" />
        <div className="h-24 rounded bg-inset" />
      </>
    ) : (
      (leading ?? undefined)
    );
  return DictionaryFieldRouteLoading({
    headingId,
    titlePath,
    loadingPath,
    className,
    ...(headerClassName !== undefined ? { headerClassName } : {}),
    ...(titleClassName !== undefined ? { titleClassName } : {}),
    ...(statusClassName !== undefined ? { statusClassName } : {}),
    rows,
    rowClassName,
    ...(resolvedLeading !== undefined ? { leading: resolvedLeading } : {}),
  });
}

export function CommunityRulesRouteLoading() {
  return LegalDocumentRouteLoading({
    headingId: "community-rules-loading-heading",
    titlePath: "legal.communityRules.title",
  });
}

export function CopyrightRouteLoading() {
  return LegalDocumentRouteLoading({
    headingId: "copyright-loading-heading",
    titlePath: "legal.copyright.title",
    leading: (
      <>
        <div className="h-4 w-40 rounded bg-inset" />
        <div className="h-24 rounded bg-inset" />
        <div className="h-24 rounded bg-inset" />
      </>
    ),
  });
}

export function PrivacyRouteLoading() {
  return LegalDocumentRouteLoading({
    headingId: "privacy-loading-heading",
    titlePath: "legal.privacy.title",
  });
}

export function TermsRouteLoading() {
  return LegalDocumentRouteLoading({
    headingId: "terms-loading-heading",
    titlePath: "legal.terms.title",
  });
}
