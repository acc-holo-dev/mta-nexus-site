import { getOrganizationCopy } from "../../../../features/organizations/organization-workspace-copy";
import { LocaleCopyRouteLoading } from "../../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "organization-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-5 overflow-x-clip py-8",
    rowClassName: "h-28 rounded bg-inset",
    leading: <div className="h-10 w-2/3 max-w-md rounded bg-inset" />,
    load: (locale) => {
      const copy = getOrganizationCopy(locale);
      return {
        title: copy.profile,
        loading: copy.loading,
      };
    },
  });
}
