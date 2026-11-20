import { AdminResourceRouteLoading } from "../../../../../features/resources/admin-resource-route-loading-server";
import { resourceMediaCopy } from "../../../../../features/resources/resource-media-i18n";

export default async function Loading() {
  return AdminResourceRouteLoading({
    headingId: "admin-resource-media-loading-heading",
    title: (locale) => resourceMediaCopy(locale).title,
  });
}
