import { AdminResourceRouteLoading } from "../../../../../../features/resources/admin-resource-route-loading-server";
import { getResourceBuildWorkspaceCopy } from "../../../../../../features/resources/resource-build-workspace-i18n";

export default async function Loading() {
  return AdminResourceRouteLoading({
    headingId: "admin-resource-build-loading-heading",
    title: (locale) => getResourceBuildWorkspaceCopy(locale).title,
  });
}
