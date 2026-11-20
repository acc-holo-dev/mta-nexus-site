import { AdminResourceRouteLoading } from "../../../../../../../features/resources/admin-resource-route-loading-server";
import { buildPackageCopy } from "../../../../../../../features/resources/build-package-i18n";

export default async function Loading() {
  return AdminResourceRouteLoading({
    headingId: "admin-resource-build-package-loading-heading",
    title: (locale) => buildPackageCopy(locale).inventory,
  });
}
