import { ResourceRequirementsRouteLoading } from "../../../../../features/resources/resource-requirements-route-loading-server";
import { pageShellMax5xl } from "../../../../../features/shell/page-shell";

export default async function Loading() {
  return ResourceRequirementsRouteLoading({
    headingId: "library-requirements-loading-heading",
    className: pageShellMax5xl,
    rows: 4,
    leading: <div className="h-10 w-64 rounded bg-inset" />,
    titleKey: "title",
  });
}
