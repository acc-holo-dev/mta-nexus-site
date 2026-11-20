import type { ReactNode } from "react";
import { pageShellMax4xl, pageShellMax4xlTight, pageShellMax5xl } from "../../shell/page-shell";
import { LocaleCopyRouteLoading } from "../../shell/route-honest-loading-server";
import { libraryCollectionsCopy } from "../library-collections-i18n";

type CollectionsCopy = ReturnType<typeof libraryCollectionsCopy>;
type CollectionsTitleKey = {
  [K in keyof CollectionsCopy]-?: CollectionsCopy[K] extends string ? K : never;
}[keyof CollectionsCopy];

function LibraryCollectionsRouteLoading({
  headingId,
  titleKey,
  loadingKey = "loading",
  className = pageShellMax5xl,
  headerClassName,
  titleClassName,
  statusClassName,
  rows = 4,
  rowClassName = "h-24 rounded bg-inset",
  leading,
}: {
  headingId: string;
  titleKey: CollectionsTitleKey;
  loadingKey?: CollectionsTitleKey;
  className?: string;
  headerClassName?: string;
  titleClassName?: string;
  statusClassName?: string;
  rows?: number;
  rowClassName?: string;
  /** Pass `null` to omit the default leading pulse block. */
  leading?: ReactNode | null;
}) {
  const resolvedLeading =
    leading === undefined ? <div className="h-10 w-64 rounded bg-inset" /> : (leading ?? undefined);
  return LocaleCopyRouteLoading({
    headingId,
    className,
    ...(headerClassName !== undefined ? { headerClassName } : {}),
    ...(titleClassName !== undefined ? { titleClassName } : {}),
    ...(statusClassName !== undefined ? { statusClassName } : {}),
    rows,
    rowClassName,
    ...(resolvedLeading !== undefined ? { leading: resolvedLeading } : {}),
    load: (locale) => {
      const copy = libraryCollectionsCopy(locale === "ru" ? "ru" : "en");
      return {
        title: copy[titleKey],
        loading: copy[loadingKey],
      };
    },
  });
}

export function ResourceCollectionsRouteLoading() {
  return LibraryCollectionsRouteLoading({
    headingId: "resource-collections-loading-heading",
    titleKey: "resourceCollections",
    rows: 3,
  });
}

export function CollectionAddRouteLoading() {
  return LibraryCollectionsRouteLoading({
    headingId: "collection-add-loading-heading",
    titleKey: "add",
  });
}

export function CollectionCopyRouteLoading() {
  return LibraryCollectionsRouteLoading({
    headingId: "collection-copy-loading-heading",
    titleKey: "duplicate",
  });
}

export function CollectionCopyItemsRouteLoading() {
  return LibraryCollectionsRouteLoading({
    headingId: "collection-copy-items-loading-heading",
    titleKey: "copy-items",
  });
}

export function CollectionHistoryRouteLoading() {
  return LibraryCollectionsRouteLoading({
    headingId: "collection-history-loading-heading",
    titleKey: "history",
  });
}

export function CollectionImportRouteLoading() {
  return LibraryCollectionsRouteLoading({
    headingId: "collection-import-loading-heading",
    titleKey: "title",
  });
}

export function LibraryCollectionDetailRouteLoading() {
  return LibraryCollectionsRouteLoading({
    headingId: "library-collection-detail-loading-heading",
    titleKey: "title",
    className: pageShellMax4xlTight,
    rows: 3,
    leading: <div className="h-28 rounded bg-inset" />,
  });
}

export function CollectionMoveItemsRouteLoading() {
  return LibraryCollectionsRouteLoading({
    headingId: "collection-move-items-loading-heading",
    titleKey: "move-items",
  });
}

export function CollectionReconcileRouteLoading() {
  return LibraryCollectionsRouteLoading({
    headingId: "collection-reconcile-loading-heading",
    titleKey: "reconcile-items",
    leading: <div className="h-10 w-72 rounded bg-inset" />,
  });
}

export function CollectionReleasesRouteLoading() {
  return LibraryCollectionsRouteLoading({
    headingId: "collection-releases-loading-heading",
    titleKey: "items",
  });
}

export function CollectionRequirementsRouteLoading() {
  return LibraryCollectionsRouteLoading({
    headingId: "collection-requirements-loading-heading",
    titleKey: "items",
  });
}

export function CollectionVersionsHistoryRouteLoading() {
  return LibraryCollectionsRouteLoading({
    headingId: "collection-versions-history-loading-heading",
    titleKey: "versions",
  });
}

export function CollectionVersionsRouteLoading() {
  return LibraryCollectionsRouteLoading({
    headingId: "collection-versions-loading-heading",
    titleKey: "versions",
  });
}

export function LibraryCollectionsRouteLoadingPort() {
  return LibraryCollectionsRouteLoading({
    headingId: "library-collections-loading-heading",
    titleKey: "title",
    className: pageShellMax4xl,
    rows: 3,
    leading: <div className="h-28 rounded bg-inset" />,
  });
}

export function MembershipHistoryDetailRouteLoading() {
  return LibraryCollectionsRouteLoading({
    headingId: "membership-history-detail-loading-heading",
    titleKey: "history",
  });
}

export function CollectionReceiptRouteLoading() {
  return LibraryCollectionsRouteLoading({
    headingId: "collection-receipt-loading-heading",
    titleKey: "history",
  });
}

export function CollectionResourcesRouteLoading() {
  return LibraryCollectionsRouteLoading({
    headingId: "collection-resources-loading-heading",
    titleKey: "resourceCollections",
  });
}
