import { getLibraryCopy } from "../../../features/library/library-view";
import { LocaleCopyRouteLoading } from "../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "library-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8",
    rows: 4,
    rowClassName: "h-28 rounded bg-inset",
    leading: (
      <>
        <div className="h-10 w-72 rounded bg-inset" />
        <div className="h-24 rounded bg-inset" />
      </>
    ),
    load: (locale) => {
      const copy = getLibraryCopy(locale);
      return {
        title: copy.title,
        loading: copy.loading,
      };
    },
  });
}
