import { getCommerceHistoryCopy } from "../../../../features/commerce/commerce-history-i18n";
import { getLicenseControlCopy } from "../../../../features/commerce/license-control-i18n";
import { LocaleCopyRouteLoading } from "../../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "admin-license-detail-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8",
    leading: <div className="h-28 rounded bg-inset" />,
    load: (locale) => {
      const copy = getLicenseControlCopy(locale);
      const history = getCommerceHistoryCopy(locale);
      return {
        title: copy.title,
        loading: history.loading,
      };
    },
  });
}
