import { ArticlesRouteLoading } from "../../../features/community/articles-route-loading-server";
import { pageShellMax4xlTight } from "../../../features/shell/page-shell";

export default async function Loading() {
  return ArticlesRouteLoading({
    headingId: "article-loading-heading",
    className: pageShellMax4xlTight,
    rows: 0,
    leading: (
      <>
        <div className="h-10 w-72 max-w-full rounded bg-inset" />
        <div className="h-40 rounded bg-inset" />
        <div className="h-64 rounded bg-inset" />
      </>
    ),
  });
}
