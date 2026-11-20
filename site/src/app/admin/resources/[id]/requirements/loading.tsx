import { ResourceRequirementsRouteLoading } from "../../../../../features/resources/resource-requirements-route-loading-server";

export default async function Loading() {
  return ResourceRequirementsRouteLoading({
    headingId: "admin-resource-requirements-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8",
    rows: 4,
    leading: <div className="h-10 w-72 rounded bg-inset" />,
    titleKey: "title",
  });
}
