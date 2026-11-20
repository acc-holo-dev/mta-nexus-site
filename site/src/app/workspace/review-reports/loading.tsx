import { resourceReviewCopy } from "../../../features/resources/resource-review-i18n";
import { LocaleCopyRouteLoading } from "../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "review-reports-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip",
    leading: <div className="h-28 rounded bg-inset" />,
    load: (locale) => {
      const typedLocale: "en" | "ru" = locale === "ru" ? "ru" : "en";
      const copy = resourceReviewCopy(typedLocale);
      return {
        title: copy.reports,
        loading: copy.loading,
      };
    },
  });
}
