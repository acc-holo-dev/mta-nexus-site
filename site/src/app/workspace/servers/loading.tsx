import { getManagedServerCopy } from "../../../features/servers/managed-server-view";
import { LocaleCopyRouteLoading } from "../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "managed-servers-loading-heading",
    className: "mx-auto min-w-0 max-w-6xl space-y-6 overflow-x-clip py-8",
    leading: <div className="h-28 rounded bg-inset" />,
    load: (locale) => {
      const copy = getManagedServerCopy(locale);
      return {
        title: copy.title,
        loading: copy.loading,
      };
    },
  });
}
