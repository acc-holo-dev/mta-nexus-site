import { resourceRequirementsCopy } from "../../../../../features/resources/resource-requirements-i18n";
import { LocaleCopyRouteLoading } from "../../../../../features/shell/route-honest-loading-server";
import { getDictionary } from "../../../../../lib/i18n";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "admin-resource-requirements-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8",
    rows: 4,
    leading: <div className="h-10 w-72 rounded bg-inset" />,
    load: (locale) => {
      const copy = resourceRequirementsCopy(locale);
      const admin = getDictionary(locale).admin;
      return {
        title: copy.title,
        loading: admin.loading,
      };
    },
  });
}
