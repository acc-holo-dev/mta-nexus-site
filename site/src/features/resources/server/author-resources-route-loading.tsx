import type { ReactNode } from "react";
import { pageShellMax5xl, pageShellMax5xlTight } from "../../shell/page-shell";
import { DictionaryRouteLoading } from "../../shell/route-honest-loading-server";
import { skelH10W64, skelH10W72, skelH32 } from "../../shell/skeleton-shell";

type AuthorResourcesTitleKey = "title" | "edit";

function AuthorResourcesRouteLoading({
  headingId,
  titleKey = "title",
  className = pageShellMax5xl,
  headerClassName,
  statusClassName,
  rows = 4,
  rowClassName = "h-24 rounded bg-inset",
  leading = <div className={skelH10W72} />,
}: {
  headingId: string;
  titleKey?: AuthorResourcesTitleKey;
  className?: string;
  headerClassName?: string;
  statusClassName?: string;
  rows?: number;
  rowClassName?: string;
  leading?: ReactNode;
}) {
  return DictionaryRouteLoading({
    headingId,
    className,
    ...(headerClassName !== undefined ? { headerClassName } : {}),
    ...(statusClassName !== undefined ? { statusClassName } : {}),
    rows,
    rowClassName,
    leading,
    pick: (dictionary) => ({
      title: dictionary.authorResources[titleKey],
      loading: dictionary.authorResources.loading,
    }),
  });
}

export function OrgContentDetailRouteLoading() {
  return AuthorResourcesRouteLoading({
    headingId: "org-content-detail-loading-heading",
    leading: <div className={skelH10W64} />,
  });
}

export function OrgContentRouteLoading() {
  return AuthorResourcesRouteLoading({
    headingId: "org-content-loading-heading",
    leading: <div className={skelH10W64} />,
  });
}

export function OrgContentNewRouteLoading() {
  return AuthorResourcesRouteLoading({
    headingId: "org-content-new-loading-heading",
    leading: <div className={skelH10W64} />,
  });
}

export function AuthorResourceActivityRouteLoading() {
  return AuthorResourcesRouteLoading({
    headingId: "resource-activity-loading-heading",
    leading: <div className={skelH10W64} />,
  });
}

export function ResourceBuildRouteLoading() {
  return AuthorResourcesRouteLoading({
    headingId: "resource-build-loading-heading",
    leading: <div className={skelH10W64} />,
  });
}

export function ResourceBuildPackageRouteLoading() {
  return AuthorResourcesRouteLoading({
    headingId: "resource-build-package-loading-heading",
    leading: <div className={skelH10W64} />,
  });
}

export function ResourceCompatibilityRouteLoading() {
  return AuthorResourcesRouteLoading({
    headingId: "resource-compatibility-loading-heading",
    leading: <div className={skelH10W64} />,
  });
}

export function ResourceCopyReceiptRouteLoading() {
  return AuthorResourcesRouteLoading({
    headingId: "resource-copy-receipt-loading-heading",
    leading: <div className={skelH10W64} />,
  });
}

export function ResourceCopiesRouteLoading() {
  return AuthorResourcesRouteLoading({
    headingId: "resource-copies-loading-heading",
    leading: <div className={skelH10W64} />,
  });
}

export function ResourceCopyRouteLoading() {
  return AuthorResourcesRouteLoading({
    headingId: "resource-copy-loading-heading",
    leading: <div className={skelH10W64} />,
  });
}

export function AuthorResourceDeliveriesRouteLoading() {
  return AuthorResourcesRouteLoading({
    headingId: "resource-deliveries-loading-heading",
    leading: <div className={skelH10W64} />,
  });
}

export function ResourceHistoryRouteLoading() {
  return AuthorResourcesRouteLoading({
    headingId: "resource-history-loading-heading",
    leading: <div className={skelH10W64} />,
  });
}

export function AuthorResourceRouteLoading() {
  return AuthorResourcesRouteLoading({
    headingId: "author-resource-loading-heading",
    titleKey: "edit",
    className: pageShellMax5xlTight,
    headerClassName: "border-b border-base pb-6",
    statusClassName: "mt-2 text-sm text-muted",
    leading: <div className={skelH32} />,
    rows: 3,
  });
}

export function ResourceMediaRouteLoading() {
  return AuthorResourcesRouteLoading({
    headingId: "resource-media-loading-heading",
    leading: <div className={skelH10W64} />,
  });
}

export function ResourceModerationRouteLoading() {
  return AuthorResourcesRouteLoading({
    headingId: "resource-moderation-loading-heading",
    leading: <div className={skelH10W64} />,
  });
}

export function AuthorResourceRequirementsRouteLoading() {
  return AuthorResourcesRouteLoading({
    headingId: "resource-requirements-loading-heading",
    leading: <div className={skelH10W64} />,
  });
}

export function ResourceVariantsRouteLoading() {
  return AuthorResourcesRouteLoading({
    headingId: "resource-variants-loading-heading",
    leading: <div className={skelH10W64} />,
  });
}

export function AuthorResourcesIndexRouteLoading() {
  return AuthorResourcesRouteLoading({
    headingId: "author-resources-loading-heading",
  });
}

export function NewResourceRouteLoading() {
  return AuthorResourcesRouteLoading({
    headingId: "new-resource-loading-heading",
    leading: <div className={skelH10W64} />,
  });
}
