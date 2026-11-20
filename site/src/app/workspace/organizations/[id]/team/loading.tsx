import { organizationTeamCopy } from "../../../../../features/organizations/organization-team-copy";
import { LocaleCopyRouteLoading } from "../../../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "organization-team-loading-heading",
    className: "mx-auto min-w-0 max-w-4xl space-y-4 overflow-x-clip py-8",
    titleClassName: "text-xl font-semibold text-primary",
    rowClassName: "h-16 rounded bg-inset",
    leading: <div className="h-6 w-2/3 rounded bg-inset" />,
    load: (locale) => {
      const copy = organizationTeamCopy(locale);
      return {
        title: copy.title,
        loading: copy.loading,
      };
    },
  });
}
